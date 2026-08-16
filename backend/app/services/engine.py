import os
import json
import re
import httpx
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models.base import User, Complaint, Attachment, AgentEvaluation, DecisionLog, AuditTrail, TrustScoreHistory, Department, Comment

def safe_parse_json_from_llm(raw_text: str) -> dict:
    """Robustly extracts and parses JSON payload from LLM responses even with extra commentary or markdown."""
    if not raw_text:
        raise ValueError("Empty response received from LLM")
    
    text = raw_text.strip()
    
    # 1. Strip markdown code fences if present
    if "```json" in text:
        try:
            extracted = text.split("```json", 1)[1].split("```", 1)[0].strip()
            return json.loads(extracted)
        except Exception:
            pass
    elif "```" in text:
        try:
            extracted = text.split("```", 1)[1].split("```", 1)[0].strip()
            return json.loads(extracted)
        except Exception:
            pass

    # 2. Try direct load
    try:
        return json.loads(text)
    except Exception:
        pass

    # 3. Find outer JSON object braces
    first_brace = text.find("{")
    last_brace = text.rfind("}")
    if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
        snippet = text[first_brace:last_brace + 1]
        try:
            return json.loads(snippet)
        except Exception:
            # Clean trailing commas
            cleaned = re.sub(r",\s*([\]}])", r"\1", snippet)
            try:
                return json.loads(cleaned)
            except Exception:
                pass

    # 4. Fallback line-by-line regex parser
    result = {}
    for line in text.split("\n"):
        match = re.search(r'["\']?([a-zA-Z0-9_]+)["\']?\s*:\s*([^,\n}]+)', line)
        if match:
            k, v = match.group(1).strip(), match.group(2).strip().strip('"').strip("'")
            if v.isdigit():
                result[k] = int(v)
            elif v.replace('.', '', 1).isdigit() and '.' in v:
                result[k] = float(v)
            elif v.lower() == "true":
                result[k] = True
            elif v.lower() == "false":
                result[k] = False
            else:
                result[k] = v
    if result:
        return result

    raise ValueError(f"Could not parse valid JSON from LLM: {raw_text[:200]}")

def call_grok_json(prompt: str, system_prompt: str) -> dict:
    """Invokes Grok LLM and parses structured JSON output safely."""
    api_key = settings.GROK_API_KEY or settings.CHATGROK_API_KEY or os.getenv("GROK_API_KEY") or os.getenv("CHATGROK_API_KEY")
    if not api_key or "your_actual_api_key_here" in api_key:
        raise ValueError("Grok API key is not configured inside the server environment.")

    url = settings.GROK_API_URL or "https://api.groq.com/openai/v1"
    model = settings.GROK_MODEL or "openai/gpt-oss-120b"

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.1
    }
    
    # Send request with a reasonable timeout
    response = httpx.post(url + "/chat/completions", headers=headers, json=payload, timeout=12.0)
    if response.status_code != 200:
        raise RuntimeError(f"Grok API request failed with status {response.status_code}: {response.text}")
        
    content = response.json()["choices"][0]["message"]["content"].strip()
    return safe_parse_json_from_llm(content)

def get_fallback_evidence_evaluation(complaint: Complaint, primary_file: str) -> dict:
    """Offline fallback calculation for Evidence Verification Agent (Agent 1)"""
    file_name = primary_file.lower()
    fake_indicators = ["meme", "placeholder", "generic", "dummy", "test", "selfie", "avatar", "profile"]
    is_fake = any(ind in file_name for ind in fake_indicators)
    
    if is_fake:
        reasoning = ["Offline audit flagged generic, mock, or placeholder evidence format."]
        if any(ind in file_name for ind in ["meme", "placeholder", "generic", "dummy"]):
            reasoning.append("High severity spam/placeholder image matched.")
            return {
                "evidence_score": 10,
                "evidence_quality": "poor",
                "relevance_score": 10,
                "reasoning": reasoning
            }
        else:
            reasoning.append("Filename suggests irrelevant proof (e.g. selfie/profile).")
            return {
                "evidence_score": 25,
                "evidence_quality": "poor",
                "relevance_score": 20,
                "reasoning": reasoning
            }
    else:
        return {
            "evidence_score": 85,
            "evidence_quality": "good",
            "relevance_score": 90,
            "reasoning": [
                "Offline verification completed.",
                "Evidence file name and properties conform to standard reported complaints."
            ]
        }

def get_fallback_quality_evaluation(complaint: Complaint) -> dict:
    """Offline fallback calculation for Complaint Quality Agent (Agent 2)"""
    title_desc_lower = (complaint.title + " " + complaint.description).lower()
    nonsense_patterns = [r"^asdf", r"^xyz", r"^qwer", r"^test", r"^123", r"^\s*$"]
    is_nonsense = any(re.match(pattern, title_desc_lower) for pattern in nonsense_patterns)
    is_too_short = len(complaint.description.strip()) < 15
    
    if is_nonsense or is_too_short:
        return {
            "quality_score": 15,
            "missing_information": [
                "Detailed explanation of the grievance",
                "Timeline and impact context"
            ],
            "reasoning": ["Description is blank, extremely short, or contains mock placeholder sequences."]
        }
        
    desc_len = len(complaint.description)
    if desc_len > 250:
        quality_score = 90
    elif desc_len > 100:
        quality_score = 75
    else:
        quality_score = 55
        
    missing_info = []
    # Check for room/location keywords
    if not any(kw in title_desc_lower for kw in ["room", "floor", "hall", "block", "canteen", "lab"]):
        missing_info.append("Specific floor, room, or location identifiers within campus")
    # Check for timeline keywords
    if not any(kw in title_desc_lower for kw in ["since", "when", "time", "date", "days", "hours"]):
        missing_info.append("Timeline / duration of the issue")
    # Check for impact keywords
    if not any(kw in title_desc_lower for kw in ["impact", "affect", "slippery", "prevent", "cannot"]):
        missing_info.append("Impact explanation on student utility/routine")
        
    return {
        "quality_score": quality_score,
        "missing_information": missing_info,
        "reasoning": [
            f"Offline quality audit completed. Text length evaluated at {desc_len} characters.",
            "Description contains constructive and clear reporting features."
        ]
    }

def get_fallback_severity_evaluation(complaint: Complaint) -> dict:
    """Offline fallback calculation for Severity Assessment Agent (Agent 4)"""
    title_desc_lower = (complaint.title + " " + complaint.description).lower()
    
    critical_keywords = [
        "shock", "sparking", "fire", "wire", "hazard", "collapse", "injury", "short circuit", "exposed wire"
    ]
    high_keywords = [
        "flood", "outage", "leak", "exam", "shut down", "broken pipe", "leakage from ceiling", "water leaking"
    ]
    
    if any(kw in title_desc_lower for kw in critical_keywords):
        return {
            "severity": "Critical",
            "confidence": 95,
            "reasoning": ["Offline severity scan identified direct structural, electrical, or physical safety hazards."]
        }
    elif any(kw in title_desc_lower for kw in high_keywords):
        return {
            "severity": "High",
            "confidence": 85,
            "reasoning": ["Offline severity scan flagged major utility failure or severe impact during critical schedules."]
        }
    elif "suggestion" in title_desc_lower or "feedback" in title_desc_lower:
        return {
            "severity": "Low",
            "confidence": 90,
            "reasoning": ["Offline scanner classified input as a routine suggestion or operational feedback."]
        }
    else:
        return {
            "severity": "Medium",
            "confidence": 75,
            "reasoning": ["Offline scan categorized grievance as a standard administrative or maintenance issue."]
        }

def run_integrity_assessment_pipeline(complaint_id: str, db: Session) -> dict:
    """Executes the Event-driven Multi-Agent Integrity, Trust, and Severity Pipeline."""
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        raise ValueError("Complaint not found.")
        
    student = complaint.student
    title_desc_lower = (complaint.title + " " + complaint.description).lower()
    
    # 0. Log pipeline initialization in audit trail
    db.add(AuditTrail(
        complaint_id=complaint.id,
        action="PIPELINE_STARTED",
        actor="SYSTEM",
        notes="Event triggered: multi-agent integrity, trust, and severity scoring initialized."
    ))
    db.commit()

    # 1. Evidence Verification Agent (Agent 1)
    evidence_res = {
        "evidence_score": 0,
        "evidence_quality": "poor",
        "relevance_score": 0,
        "reasoning": ["No evidence attachments uploaded."]
    }
    attachments = complaint.attachments
    has_grok = False
    
    # Check if Grok is available
    api_key = settings.GROK_API_KEY or settings.CHATGROK_API_KEY or os.getenv("GROK_API_KEY") or os.getenv("CHATGROK_API_KEY")
    if api_key and "your_actual_api_key_here" not in api_key:
        has_grok = True
        
    if attachments:
        primary_file = attachments[0].file_url
        if has_grok:
            sys_p1 = "You are the CampusBridge AI Evidence Auditor Agent."
            p1 = (
                f"Analyze this submitted evidence proof:\n"
                f"Reported Grievance: {complaint.title}\n"
                f"Reported Description: {complaint.description}\n"
                f"Evidence Proof File: {primary_file}\n"
                f"Evaluate relevance and quality, noting that placeholder filenames like 'meme.jpg', 'avatar.png', 'test.pdf', 'selfie.jpg' denote low quality or irrelevant files.\n"
                f"Respond EXACTLY in this JSON format:\n"
                f'{{"evidence_score": 0-100, "evidence_quality": "poor|average|good", "relevance_score": 0-100, "reasoning": ["statement 1"]}}'
            )
            try:
                evidence_res = call_grok_json(p1, sys_p1)
                # Log agent evaluation
                db.add(AgentEvaluation(
                    complaint_id=complaint.id,
                    agent_name="Evidence_Agent",
                    raw_response=json.dumps(evidence_res),
                    score_metric=evidence_res["evidence_score"]
                ))
            except Exception as e:
                # Catch LLM/connection errors and use local fallback
                evidence_res = get_fallback_evidence_evaluation(complaint, primary_file)
                db.add(AgentEvaluation(
                    complaint_id=complaint.id,
                    agent_name="Evidence_Agent (Fallback)",
                    raw_response=json.dumps(evidence_res),
                    score_metric=evidence_res["evidence_score"]
                ))
        else:
            evidence_res = get_fallback_evidence_evaluation(complaint, primary_file)
            db.add(AgentEvaluation(
                complaint_id=complaint.id,
                agent_name="Evidence_Agent (Offline Fallback)",
                raw_response=json.dumps(evidence_res),
                score_metric=evidence_res["evidence_score"]
            ))
            
        # Write back to individual attachment object
        attachments[0].ai_verification_status = "verified" if evidence_res["evidence_score"] >= 40 else "rejected"
        attachments[0].ai_verification_explanation = f"Automated Score: {evidence_res['evidence_score']}. Quality: {evidence_res['evidence_quality']}. Reason: {'; '.join(evidence_res['reasoning'])}"
    else:
        # Log empty evaluation
        db.add(AgentEvaluation(
            complaint_id=complaint.id,
            agent_name="Evidence_Agent",
            raw_response=json.dumps(evidence_res),
            score_metric=0
        ))

    # 2. Complaint Quality Agent (Agent 2)
    quality_res = {
        "quality_score": 0,
        "missing_information": [],
        "reasoning": []
    }
    if has_grok:
        sys_p2 = "You are the CampusBridge AI Quality Auditor Agent."
        p2 = (
            f"Analyze this grievance description text:\n"
            f"Title: {complaint.title}\n"
            f"Description: {complaint.description}\n"
            f"Location: {complaint.location}\n"
            f"Evaluate quality and completeness. List any missing critical items (like specific floor, timeline, or severity details).\n"
            f"Respond EXACTLY in this JSON format:\n"
            f'{{"quality_score": 0-100, "missing_information": ["item 1"], "reasoning": ["statement 1"]}}'
        )
        try:
            quality_res = call_grok_json(p2, sys_p2)
            db.add(AgentEvaluation(
                complaint_id=complaint.id,
                agent_name="Quality_Agent",
                raw_response=json.dumps(quality_res),
                score_metric=quality_res["quality_score"]
            ))
        except Exception as e:
            quality_res = get_fallback_quality_evaluation(complaint)
            db.add(AgentEvaluation(
                complaint_id=complaint.id,
                agent_name="Quality_Agent (Fallback)",
                raw_response=json.dumps(quality_res),
                score_metric=quality_res["quality_score"]
            ))
    else:
        quality_res = get_fallback_quality_evaluation(complaint)
        db.add(AgentEvaluation(
            complaint_id=complaint.id,
            agent_name="Quality_Agent (Offline Fallback)",
            raw_response=json.dumps(quality_res),
            score_metric=quality_res["quality_score"]
        ))

    def _safe_float(val, default=0.0):
        if val is None:
            return default
        if isinstance(val, (list, tuple)):
            return _safe_float(val[0] if val else default, default)
        try:
            return float(val)
        except (ValueError, TypeError):
            return default

    q_score = _safe_float(quality_res.get("quality_score"), 70.0)
    e_score = _safe_float(evidence_res.get("evidence_score"), 0.0)
    r_score = _safe_float(evidence_res.get("relevance_score"), 0.0)
    t_score = _safe_float(getattr(student, "trust_score", 100.0), 100.0)

    # 3. Deterministic Integrity Assessment Agent (Agent 3)
    reasoning_steps = []
    
    if attachments:
        # Weighted average of Quality (30%), Evidence (30%), Relevance (20%), and Student Trust (20%)
        q_weight, e_weight, r_weight, t_weight = 0.30, 0.30, 0.20, 0.20
        weighted_base = (
            (q_score * q_weight) +
            (e_score * e_weight) +
            (r_score * r_weight) +
            (t_score * t_weight)
        )
        reasoning_steps.append(
            f"Weighted multi-criteria base score calculated: "
            f"Quality {q_score:.0f} ({q_weight:.0%}) + "
            f"Evidence {e_score:.0f} ({e_weight:.0%}) + "
            f"Relevance {r_score:.0f} ({r_weight:.0%}) + "
            f"User Trust {t_score:.1f}% ({t_weight:.0%}) = {weighted_base:.1f}."
        )
    else:
        # Weighted average of Quality (70%) and Student Trust (30%)
        q_weight, t_weight = 0.70, 0.30
        weighted_base = (
            (q_score * q_weight) +
            (t_score * t_weight)
        )
        reasoning_steps.append(
            f"Weighted multi-criteria base score calculated (no attachments): "
            f"Quality {q_score:.0f} ({q_weight:.0%}) + "
            f"User Trust {t_score:.1f}% ({t_weight:.0%}) = {weighted_base:.1f}."
        )

    # Apply strict penalties on top of the weighted base
    score_mod = 0.0
    
    # Penalty Rule 1: Missing Evidence for Maintenance reports
    if not attachments:
        maintenance_keywords = ["leak", "broken", "crack", "water", "shattered", "collapsed", "burnt", "dripping", "overflow"]
        if any(kw in title_desc_lower for kw in maintenance_keywords):
            score_mod -= 15
            reasoning_steps.append("Maintenance/leakage complaint reported with missing visual proof (-15).")

    # Penalty Rule 2: Low Text Quality / Gibberish / Mock
    if q_score < 30:
        score_mod -= 40
        reasoning_steps.append("Complaint text flagged as mock, extremely short, or gibberish (-40).")

    # Penalty Rule 3: Irrelevant Evidence (already factored into base, but apply minor check if needed)
    if attachments and r_score < 40:
        reasoning_steps.append("Evidence relevance is extremely low (already factored into base score).")

    # Penalty Rule 4: Duplicate checks
    if complaint.is_duplicate:
        score_mod -= 20
        reasoning_steps.append("Grievance flagged as semantic duplicate of an active complaint (-20).")

    # Sum and clamp to [0, 100]
    final_score_raw = weighted_base + score_mod
    final_integrity_score = max(0, min(100, int(round(final_score_raw))))
    
    # Calculate a proxy confidence index
    confidence_index = int((q_score + (r_score if attachments else 80.0)) / 2.0)

    # 4. Severity Assessment Agent (Agent 4)
    severity_res = {
        "severity": "Medium",
        "confidence": 80,
        "reasoning": []
    }
    if has_grok:
        sys_p4 = "You are the CampusBridge AI Severity Auditor Agent."
        p4 = (
            f"Analyze this campus complaint:\n"
            f"Title: {complaint.title}\n"
            f"Description: {complaint.description}\n"
            f"Location: {complaint.location}\n"
            f"Respond EXACTLY in this JSON format:\n"
            f'{{"severity": "Critical|High|Medium|Low", "confidence": 0-100, "reasoning": ["statement 1"]}}'
        )
        try:
            severity_res = call_grok_json(p4, sys_p4)
            db.add(AgentEvaluation(
                complaint_id=complaint.id,
                agent_name="Severity_Agent",
                raw_response=json.dumps(severity_res),
                score_metric=severity_res["confidence"]
            ))
        except Exception as e:
            severity_res = get_fallback_severity_evaluation(complaint)
            db.add(AgentEvaluation(
                complaint_id=complaint.id,
                agent_name="Severity_Agent (Fallback)",
                raw_response=json.dumps(severity_res),
                score_metric=severity_res["confidence"]
            ))
    else:
        severity_res = get_fallback_severity_evaluation(complaint)
        db.add(AgentEvaluation(
            complaint_id=complaint.id,
            agent_name="Severity_Agent (Offline Fallback)",
            raw_response=json.dumps(severity_res),
            score_metric=severity_res["confidence"]
        ))

    # 5. Deterministic Decision Agent (Agent 5)
    final_decision = "FORWARD_TO_DEPARTMENT"
    info_prompt = None

    if final_integrity_score < 30:
        final_decision = "REJECT"
        complaint.status = "rejected"
        complaint.info_requested = None
    elif final_integrity_score < 60:
        final_decision = "REQUEST_ADDITIONAL_INFO"
        complaint.status = "pending_info"
        
        # Determine specific requirements for additional documents / info
        needs_evidence = not attachments
        needs_more_detail = quality_res.get("quality_score", 50) < 50 or len(complaint.description.strip()) < 80
        
        req_parts = []
        if needs_evidence:
            req_parts.append("Upload clear photo or PDF document proof of the issue (e.g. photo of damaged equipment, leak, invoice/receipt, or official notice)")
        if needs_more_detail:
            req_parts.append("Provide specific location details (exact room number, floor, building block) and time when the issue occurred")
        if not req_parts:
            req_parts.append("Provide supporting photographic evidence and additional context to verify institutional authenticity")
            
        info_prompt = "; ".join(req_parts) + "."
        complaint.info_requested = info_prompt
    else:
        final_decision = "FORWARD_TO_DEPARTMENT"
        complaint.status = "verified"
        complaint.info_requested = None
        
    # Dynamic Trust Score Adjustment to the Student
    old_trust = student.trust_score
    trust_delta = 0.0
    if final_decision == "REJECT":
        trust_delta = -10.0
    elif final_decision == "FORWARD_TO_DEPARTMENT" and final_integrity_score >= 80:
        trust_delta = 2.0
        
    if trust_delta != 0.0:
        student.trust_score = max(0.0, min(100.0, student.trust_score + trust_delta))
        db.add(TrustScoreHistory(
            user_id=student.id,
            previous_score=old_trust,
            new_score=student.trust_score,
            delta=trust_delta,
            reason=f"Automated assessment: final decision sealed as {final_decision}."
        ))

    # Send action required email to student when score is between 30 and 60
    if final_decision == "REQUEST_ADDITIONAL_INFO" and student and student.email:
        try:
            from app.services.email_service import dispatch_additional_info_request_notification
            dispatch_additional_info_request_notification(
                student_email=student.email,
                student_name=student.full_name,
                complaint_title=complaint.title,
                complaint_id=complaint.id,
                info_requested=info_prompt or "Please provide additional supporting documents or details.",
                integrity_score=final_integrity_score
            )
        except Exception as e:
            print(f"Failed to dispatch additional info request email: {e}")
        
    # Override urgency in complaint based on AI evaluation
    complaint.urgency = severity_res["severity"].lower()

    # Route/assign department using keyword matcher (same rules as ai_agent)
    routing_rules = {
        "HOSTEL": ["hostel", "room", "fan", "bed", "warden", "mess", "lobby", "block", "corridor", "geyser", "bathroom", "shower"],
        "IT": ["wifi", "internet", "network", "drop", "connection", "portal", "website", "login", "router", "signal", "bandwidth", "speed"],
        "ELECTRICAL": ["socket", "wire", "bulb", "light", "switch", "air conditioner", "ac", "fan", "tripp", "breaker", "fuse", "power", "shock", "electricity"],
        "WATER": ["leak", "leakag", "water", "pipe", "plumbing", "clog", "toilet", "tap", "washbasin", "overflow", "ceiling leak"],
        "TRANSPORT": ["bus", "shuttle", "route", "timing", "delay", "transport", "driver", "service", "timing", "schedule"],
        "FINANCE": ["scholarship", "fee", "receipt", "payment", "refund", "transaction", "finance", "bank", "billing"],
        "ACADEMIC": ["classroom", "syllabus", "exam", "grades", "schedule", "professor", "course", "registration", "academic"],
        "CANTEEN": ["canteen", "food", "mess", "hygiene", "fly", "insect", "cleanliness", "lunch", "dinner", "breakfast", "kitchen"],
        "LIBRARY": ["library", "book", "card", "fine", "journal", "issue", "return", "catalog", "reading room", "study room"]
    }
    
    matched_dept_code = None
    max_matches = 0
    for code, keywords in routing_rules.items():
        matches = sum(1 for kw in keywords if kw in title_desc_lower)
        if matches > max_matches:
            max_matches = matches
            matched_dept_code = code
            
    if matched_dept_code:
        assigned_dept = db.query(Department).filter(Department.code == matched_dept_code).first()
        if assigned_dept:
            complaint.department_id = assigned_dept.id

    # Create administrative internal AI comment summarizing the assessment
    ai_comment_content = (
        f"AI Multi-Agent Assessment completed successfully:\n"
        f"- Integrity Credibility Rating: {final_integrity_score}/100\n"
        f"- Assigned Severity: {severity_res['severity'].upper()}\n"
        f"- Confidence Index: {confidence_index}%\n"
        f"- Route Decision Sealed: {final_decision}\n"
        f"- Student Trust Rating Adjusted: {trust_delta:+.1f}% (Current Trust: {student.trust_score:.1f}%)\n"
        f"- Scoring Rubric reasoning logs:\n  * " + "\n  * ".join(reasoning_steps)
    )
    db.add(Comment(
        complaint_id=complaint.id,
        user_id=None, # Null denotes AI/System generated comment
        content=ai_comment_content,
        is_internal=True,
        is_ai_generated=True
    ))

    # Add public student-visible AI notification comment when additional info is needed
    if final_decision == "REQUEST_ADDITIONAL_INFO":
        db.add(Comment(
            complaint_id=complaint.id,
            user_id=None,
            content=(
                f"AI Triage Auditor [Action Required]:\n"
                f"- Assessment Rating: {final_integrity_score}/100\n"
                f"- Requested Details/Documents: {info_prompt}\n"
                f"Please submit the requested information or upload evidence via the dashboard form below."
            ),
            is_internal=False,
            is_ai_generated=True
        ))

    # Persist the final Decision Log
    reasoning_summary_text = "\n".join(reasoning_steps)
    decision_log = DecisionLog(
        complaint_id=complaint.id,
        integrity_score=final_integrity_score,
        severity_level=severity_res["severity"],
        confidence=confidence_index,
        decision=final_decision,
        reasoning_summary=reasoning_summary_text
    )
    db.add(decision_log)

    # Persist Audit Trail entry
    audit_notes = f"Pipeline Decision Sealed: {final_decision} (Integrity: {final_integrity_score}%, Severity: {severity_res['severity']})."
    db.add(AuditTrail(
        complaint_id=complaint.id,
        action="DECISION_SEALED",
        actor="SYSTEM",
        notes=audit_notes
    ))
    
    db.commit()
    db.refresh(complaint)
    db.refresh(student)
    
    return {
        "complaint_id": complaint.id,
        "integrity_score": final_integrity_score,
        "severity": severity_res["severity"],
        "decision": final_decision,
        "confidence": confidence_index,
        "reasoning": reasoning_steps,
        "evaluated_at": decision_log.created_at
    }
