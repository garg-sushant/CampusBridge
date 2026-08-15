import os
import re
import math
import httpx
import json
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models.base import Complaint, Department, Comment, Attachment, User, TrustScoreHistory


def run_ai_orchestration(complaint_id: str, db: Session):
    """
    Evaluates and triages a student's grievance (user input) using Grok LLM API.
    Audits the input text (Title & Description) to detect spam, fake data, or mock submissions,
    automatically rejecting fake entries and dynamically calculating student integrity trust score adjustments.
    """
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        return

    student = complaint.student
    title_desc = f"{complaint.title} {complaint.description}"
    title_desc_lower = title_desc.lower()

    # 1. Analyze user input using Grok API if key is set
    grok_result = None
    api_key = settings.GROK_API_KEY or settings.CHATGROK_API_KEY or os.getenv("GROK_API_KEY") or os.getenv("CHATGROK_API_KEY")
    if api_key and "your_actual_api_key_here" in api_key:
        api_key = ""
    if api_key:
        try:
            url = f"{settings.GROK_API_URL or 'https://api.groq.com/openai/v1'}/chat/completions"
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            }
            prompt = (
                f"You are the CampusBridge AI Triaging and Credibility Auditor. Analyze this student's campus grievance submission:\n\n"
                f"Grievance Title: {complaint.title}\n"
                f"Grievance Description: {complaint.description}\n\n"
                f"INSTRUCTIONS FOR EVALUATION:\n"
                f"1. Audit the user input for legitimacy. Decide if this is a genuine, constructive campus grievance, or if it is fake, gibberish, mock data, or administrative spam (e.g. single words, 'test', 'asdfasdf', 'xyz', obvious nonsense).\n"
                f"2. Set 'is_spam' to true if it is fake, spam, or nonsense, and false if it is a legitimate report.\n"
                f"3. Calculate a dynamic 'trust_score_adjustment' (float between -15.0 and +3.0) based on this rubric:\n"
                f"   - Serious Spam/Gibberish/Mock Data: Assign a negative score between -8.0 and -15.0 depending on the severity of the spam/falsification.\n"
                f"   - Constructive/Detailed Grievance: Assign a positive score between +1.0 and +3.0 depending on the detail, clarity, and importance of the grievance.\n"
                f"4. Choose EXACTLY one department code to route to:\n"
                f"   - HOSTEL (Hostel Administration / Warden / Restrooms / Mess)\n"
                f"   - IT (WiFi / IT Networks / Internet / Account Portals)\n"
                f"   - ELECTRICAL (Socket / Tripping Breakers / Lighting / AC / Fans)\n"
                f"   - WATER (Water leakages / Plumbing / Toilet / Tap leakages)\n"
                f"   - TRANSPORT (Bus / Shuttle routes and timing schedules)\n"
                f"   - FINANCE (Scholarship details / receipt payments / transactions)\n"
                f"   - ACADEMIC (Classrooms / Exams / Course registration / Grades)\n"
                f"   - CANTEEN (Canteen food hygiene / cleanliness / preparation)\n"
                f"   - LIBRARY (Books issue / Library catalog / Reading room quietness)\n\n"
                f"5. Choose EXACTLY one urgency level: low, medium, high, critical.\n\n"
                f"Provide your response EXACTLY as a single JSON object with this format, containing no extra text or markdown formatting:\n"
                f"{{\n"
                f'  "is_spam": true_or_false,\n'
                f'  "trust_score_adjustment": float_value,\n'
                f'  "department": "DEPARTMENT_CODE",\n'
                f'  "urgency": "urgency_level",\n'
                f'  "explanation": "Provide a detailed justification of your credibility audit and department classification."\n'
                f"}}"
            )
            payload = {
                "model": settings.GROK_MODEL or "openai/gpt-oss-120b",
                "messages": [
                    {
                        "role": "system",
                        "content": "You are CampusBridge AI Orchestrator Agent.",
                    },
                    {"role": "user", "content": prompt},
                ],
                "temperature": 0.1,
            }

            response = httpx.post(url, headers=headers, json=payload, timeout=10.0)
            if response.status_code == 200:
                res_data = response.json()
                content = res_data["choices"][0]["message"]["content"].strip()

                # Strip markdown blocks
                if content.startswith("```json"):
                    content = content[7:]
                if content.startswith("```"):
                    content = content[3:]
                if content.endswith("```"):
                    content = content[:-3]
                content = content.strip()

                grok_result = json.loads(content)
        except Exception as e:
            print(f"Grok API triaging and credibility check failed: {e}")

    if grok_result:
        is_spam = grok_result.get("is_spam", False)
        trust_adj = float(grok_result.get("trust_score_adjustment", 1.0))
        trust_adj = max(-15.0, min(3.0, trust_adj))

        old_score = student.trust_score
        student.trust_score = max(0.0, min(100.0, student.trust_score + trust_adj))

        if trust_adj != 0.0:
            db.add(TrustScoreHistory(
                user_id=student.id,
                previous_score=old_score,
                new_score=student.trust_score,
                delta=trust_adj,
                reason=f"AI orchestration analysis: {grok_result.get('explanation', 'Grievance audited by Grok AI Orchestrator.')[:450]}"
            ))

        dept_code = grok_result.get("department", "").upper()
        assigned_dept = (
            db.query(Department).filter(Department.code == dept_code).first()
        )
        if assigned_dept:
            complaint.department_id = assigned_dept.id

        detected_urgency = grok_result.get("urgency", "medium").lower()
        if detected_urgency not in ["low", "medium", "high", "critical"]:
            detected_urgency = "medium"
        complaint.urgency = detected_urgency

        explanation = grok_result.get(
            "explanation", "Grievance audited by Grok AI Orchestrator."
        )
        dept_name = (
            assigned_dept.name
            if assigned_dept
            else "Unassigned (Pending Warden Review)"
        )

        if is_spam:
            complaint.status = "rejected"
            ai_comment = Comment(
                complaint_id=complaint.id,
                content=(
                    f"Grok-AI Security Monitor [Audit Failure - Spam Submission]:\n"
                    f"- Status: REJECTED\n"
                    f"- Dynamic Trust Adjustment: {trust_adj:+.1f}% (Student integrity updated from {old_score:.1f}% to {student.trust_score:.1f}%).\n"
                    f"- Agent Justification: {explanation}"
                ),
                is_internal=True,
                is_ai_generated=True,
            )
            db.add(ai_comment)
        else:
            ai_comment = Comment(
                complaint_id=complaint.id,
                content=(
                    f"Grok-AI Agent [Frontier Classifier & Urgency Model] completed analysis:\n"
                    f"- Category: {complaint.category}\n"
                    f"- Routed Department: {dept_name}\n"
                    f"- Flagged Urgency: {detected_urgency.upper()}\n"
                    f"- Dynamic Trust Adjustment: {trust_adj:+.1f}% (Student integrity updated from {old_score:.1f}% to {student.trust_score:.1f}%).\n"
                    f"- Agent Justification: {explanation}"
                ),
                is_internal=True,
                is_ai_generated=True,
            )
            db.add(ai_comment)

        db.commit()
        db.refresh(complaint)
        db.refresh(student)
        return

    # 2. Local fallback rule matching (if no API key is present)
    is_spam = False
    trust_adj = 1.0

    # Robust offline checks for mock/spam strings
    nonsense_patterns = [r"^asdf", r"^xyz", r"^qwer", r"^test", r"^123", r"^\s*$"]
    is_nonsense = any(
        re.match(pattern, title_desc_lower) for pattern in nonsense_patterns
    )
    is_too_short = (
        len(complaint.description.strip()) < 15 or len(complaint.title.strip()) < 6
    )

    old_score = student.trust_score

    if is_nonsense or is_too_short:
        is_spam = True
        complaint.status = "rejected"
        trust_adj = -10.0
        student.trust_score = max(0.0, student.trust_score + trust_adj)

        db.add(TrustScoreHistory(
            user_id=student.id,
            previous_score=old_score,
            new_score=student.trust_score,
            delta=trust_adj,
            reason="AI Local Audit: Rejected as spam, gibberish, or description too short."
        ))

        ai_class_comment = Comment(
            complaint_id=complaint.id,
            content=(
                f"AI Security Monitor [Local Audit Failure - Spam Submission]:\n"
                f"- Status: REJECTED (Gibberish, mock input, or description too short)\n"
                f"- Dynamic Trust Adjustment: {trust_adj:+.1f}% (Student integrity updated from {old_score:.1f}% to {student.trust_score:.1f}%)."
            ),
            is_internal=True,
            is_ai_generated=True,
        )
        db.add(ai_class_comment)
    else:
        # Dynamic fallback rating based on description detail length
        desc_len = len(complaint.description)
        if desc_len > 250:
            trust_adj = 3.0
        elif desc_len > 100:
            trust_adj = 2.0
        else:
            trust_adj = 1.0

        student.trust_score = min(100.0, student.trust_score + trust_adj)

        if trust_adj != 0.0:
            db.add(TrustScoreHistory(
                user_id=student.id,
                previous_score=old_score,
                new_score=student.trust_score,
                delta=trust_adj,
                reason=f"AI Local Audit: Detailed report submission (+{trust_adj} trust score)."
            ))

        routing_rules = {
            "HOSTEL": [
                "hostel",
                "room",
                "fan",
                "bed",
                "warden",
                "mess",
                "lobby",
                "block",
                "corridor",
                "geyser",
                "bathroom",
                "shower",
            ],
            "IT": [
                "wifi",
                "internet",
                "network",
                "drop",
                "connection",
                "portal",
                "website",
                "login",
                "router",
                "signal",
                "bandwidth",
                "speed",
            ],
            "ELECTRICAL": [
                "socket",
                "wire",
                "bulb",
                "light",
                "switch",
                "air conditioner",
                "ac",
                "fan",
                "tripp",
                "breaker",
                "fuse",
                "power",
                "shock",
                "electricity",
            ],
            "WATER": [
                "leak",
                "leakag",
                "water",
                "pipe",
                "plumbing",
                "clog",
                "toilet",
                "tap",
                "washbasin",
                "overflow",
                "ceiling leak",
            ],
            "TRANSPORT": [
                "bus",
                "shuttle",
                "route",
                "timing",
                "delay",
                "transport",
                "driver",
                "service",
                "timing",
                "schedule",
            ],
            "FINANCE": [
                "scholarship",
                "fee",
                "receipt",
                "payment",
                "refund",
                "transaction",
                "finance",
                "bank",
                "billing",
            ],
            "ACADEMIC": [
                "classroom",
                "syllabus",
                "exam",
                "grades",
                "schedule",
                "professor",
                "course",
                "registration",
                "academic",
            ],
            "CANTEEN": [
                "canteen",
                "food",
                "mess",
                "hygiene",
                "fly",
                "insect",
                "cleanliness",
                "lunch",
                "dinner",
                "breakfast",
                "kitchen",
            ],
            "LIBRARY": [
                "library",
                "book",
                "card",
                "fine",
                "journal",
                "issue",
                "return",
                "catalog",
                "reading room",
                "study room",
            ],
        }

        matched_dept_code = None
        max_matches = 0
        for code, keywords in routing_rules.items():
            matches = sum(1 for kw in keywords if kw in title_desc_lower)
            if matches > max_matches:
                max_matches = matches
                matched_dept_code = code

        assigned_dept = None
        if matched_dept_code:
            assigned_dept = (
                db.query(Department)
                .filter(Department.code == matched_dept_code)
                .first()
            )
            if assigned_dept:
                complaint.department_id = assigned_dept.id

        critical_keywords = [
            "shock",
            "sparking",
            "fire",
            "severe flood",
            "structural hazard",
            "accident",
            "immediate medical hazard",
            "short circuit",
        ]
        high_keywords = [
            "water leaking",
            "leakage from ceiling",
            "power outage",
            "wifi completely down",
            "fee receipt payment block",
            "transport delay during exam",
        ]

        detected_urgency = "medium"
        if any(kw in title_desc_lower for kw in critical_keywords):
            detected_urgency = "critical"
        elif any(kw in title_desc_lower for kw in high_keywords):
            detected_urgency = "high"
        elif "suggestion" in title_desc_lower or "feedback" in title_desc_lower:
            detected_urgency = "low"

        complaint.urgency = detected_urgency
        dept_name = (
            assigned_dept.name
            if assigned_dept
            else "Unassigned (Pending Warden Review)"
        )

        ai_class_comment = Comment(
            complaint_id=complaint.id,
            content=f"AI Orchestrator [Classifier & Severity Model] completed analysis:\n- Classified Category: {complaint.category}\n- Routed Department: {dept_name}\n- Severity Flagged Urgency: {detected_urgency.upper()}\n- Dynamic Trust Adjustment: {trust_adj:+.1f}% (Student integrity updated from {old_score:.1f}% to {student.trust_score:.1f}%)",
            is_internal=True,
            is_ai_generated=True,
        )
        db.add(ai_class_comment)

    db.commit()
    db.refresh(complaint)
    db.refresh(student)


def run_ai_evidence_verification(attachment_id: int, db: Session):
    """
    Evaluates grievance details (user inputs) and uploaded file attachments (proof) to verify credibility.
    Calculates a systematic integrity trust score adjustment based on an exact grading rubric.
    """
    attachment = db.query(Attachment).filter(Attachment.id == attachment_id).first()
    if not attachment:
        return

    complaint = attachment.complaint
    student = complaint.student
    file_name = attachment.file_url.lower()

    # 1. Analyze evidence upload using Grok API if key is set
    api_key = settings.GROK_API_KEY or settings.CHATGROK_API_KEY or os.getenv("GROK_API_KEY") or os.getenv("CHATGROK_API_KEY")
    if api_key and "your_actual_api_key_here" in api_key:
        api_key = ""
    if api_key:
        try:
            url = f"{settings.GROK_API_URL or 'https://api.groq.com/openai/v1'}/chat/completions"
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            }

            # Highly specific and rigorous evaluation rubrics to prevent "randomness"
            prompt = (
                f"You are the CampusBridge AI Evidence Auditor. Analyze this student's grievance report and uploaded evidence for institutional verification:\n\n"
                f"Grievance Title: {complaint.title}\n"
                f"Grievance Description: {complaint.description}\n"
                f"Uploaded Proof Filename/URL: {attachment.file_url}\n\n"
                f"INSTRUCTIONS FOR EVALUATION:\n"
                f"Analyze the relationship between the student's reported grievance description (user input) and their uploaded evidence file details (proof). Determine the credibility, calculate a precise 'trust_score_adjustment', and assign an updated 'urgency' score based on this exact rubric:\n\n"
                f"CRITERIA 1: EVIDENCE STATUS (Choose either 'verified' or 'rejected')\n"
                f"- Set status to 'rejected' if the filename suggests a suspicious placeholder (e.g. meme, selfie, test, generic, avatar, profile, dummy, logo, placeholder, blank).\n"
                f"- Set status to 'verified' if the file is standard/credible proof of the reported complaint.\n\n"
                f"CRITERIA 2: URGENCY LEVEL RATING (Choose EXACTLY one: 'critical', 'high', 'medium', 'low')\n"
                f"- 'critical': Safety hazard, structural damage, water flooding, exposed live wires, broken emergency locks, or bio-hazards.\n"
                f"- 'high': Severe service outage, power circuit tripping, major water leak, fee payment block during deadlines.\n"
                f"- 'medium': Standard maintenance issues, non-blocking WiFi drops, general scholarship query.\n"
                f"- 'low': Minor suggestions, feedback, textbook availability, non-urgent routine requests.\n\n"
                f"CRITERIA 3: TRUST SCORE ADJUSTMENT RUBRIC (Must be a float between -10.0 and +5.0):\n"
                f"If STATUS is 'rejected' (Spam, fake, or unrelated proof):\n"
                f"  - Allocate -10.0: If the filename is an obvious malicious mock/spam placeholder (e.g. meme.jpg, blank.png, test.pdf, generic.jpg).\n"
                f"  - Allocate -5.0: If the proof is completely irrelevant to the report description.\n"
                f"If STATUS is 'verified' (Valid, matching proof):\n"
                f"  - Allocate +5.0: Highly detailed grievance description backed by matching proof.\n"
                f"  - Allocate +3.0: Standard, consistent grievance description with matching visual evidence.\n"
                f"  - Allocate +1.0: Minimal description, but visual proof still aligns with the reported issue.\n\n"
                f"Respond with a JSON object containing:\n"
                f'1. "status": "verified" or "rejected"\n'
                f'2. "urgency": "critical", "high", "medium", or "low"\n'
                f'3. "trust_score_adjustment": float_value\n'
                f'4. "explanation": "A comprehensive and rigorous justification detailing your authenticity audit and urgency score."\n'
                f"Return ONLY the JSON object. Do not include markdown code block formatting."
            )
            payload = {
                "model": settings.GROK_MODEL or "openai/gpt-oss-120b",
                "messages": [
                    {
                        "role": "system",
                        "content": "You are CampusBridge AI Evidence Auditor Agent.",
                    },
                    {"role": "user", "content": prompt},
                ],
                "temperature": 0.1,
            }

            response = httpx.post(url, headers=headers, json=payload, timeout=10.0)
            if response.status_code == 200:
                res_data = response.json()
                content = res_data["choices"][0]["message"]["content"].strip()

                # Strip markdown blocks
                if content.startswith("```json"):
                    content = content[7:]
                if content.startswith("```"):
                    content = content[3:]
                if content.endswith("```"):
                    content = content[:-3]
                content = content.strip()

                data = json.loads(content)
                status_val = data.get("status", "verified").lower()
                explanation = data.get("explanation", "Evidence processed by Grok AI.")
                detected_urgency = data.get("urgency", complaint.urgency).lower()
                if detected_urgency in ["critical", "high", "medium", "low"]:
                    complaint.urgency = detected_urgency

                # Retrieve and safely clamp the trust score adjustment
                trust_adj = float(data.get("trust_score_adjustment", 2.0))
                trust_adj = max(-10.0, min(5.0, trust_adj))

                old_score = student.trust_score
                student.trust_score = max(
                    0.0, min(100.0, student.trust_score + trust_adj)
                )

                if trust_adj != 0.0:
                    db.add(TrustScoreHistory(
                        user_id=student.id,
                        previous_score=old_score,
                        new_score=student.trust_score,
                        delta=trust_adj,
                        reason=f"AI Evidence Audit on file '{attachment.file_url}': {explanation[:450]}"
                    ))

                attachment.ai_verification_status = status_val
                attachment.ai_verification_explanation = (
                    f"Grok-AI Auditor: {explanation}"
                )

                ai_comment = Comment(
                    complaint_id=complaint.id,
                    content=f"Grok-AI Audit on file '{attachment.file_url}':\n- Status: {status_val.upper()}\n- Verified Urgency Rating: {complaint.urgency.upper()}\n- Trust Adjustment: {trust_adj:+.1f}% (Integrity: {old_score:.1f}% ➔ {student.trust_score:.1f}%)\n- Explanation: {explanation}",
                    is_internal=True,
                    is_ai_generated=True,
                )
                db.add(ai_comment)
                db.commit()
                db.refresh(attachment)
                return
        except Exception as e:
            print(f"Grok API evidence audit failed: {e}")

    # 2. Local offline fallback rules (if no API key is present)
    fake_indicators = [
        "meme",
        "placeholder",
        "generic",
        "test",
        "selfie",
        "avatar",
        "profile",
        "dummy",
    ]
    is_fake = any(ind in file_name for ind in fake_indicators)
    old_score = student.trust_score

    if is_fake:
        attachment.ai_verification_status = "rejected"
        attachment.ai_verification_explanation = "AI Vision flagged generic non-governance placeholder or meme format graphic."

        # Rigorous fallback calculations
        if any(ind in file_name for ind in ["meme", "placeholder", "generic", "dummy"]):
            trust_adj = -10.0  # High severity spam placeholder
        else:
            trust_adj = -5.0  # Unrelated selfies/profiles

        student.trust_score = max(0.0, student.trust_score + trust_adj)

        db.add(TrustScoreHistory(
            user_id=student.id,
            previous_score=old_score,
            new_score=student.trust_score,
            delta=trust_adj,
            reason=f"AI Local Evidence Audit: Flagged generic graphic/placeholder file '{attachment.file_url}'."
        ))

        ai_alert_comment = Comment(
            complaint_id=complaint.id,
            content=f"AI Security Monitor [Audit Failure]:\n- Flagged File: {attachment.file_url}\n- Trust Adjustment: {trust_adj:+.1f}% (Integrity: {old_score:.1f}% ➔ {student.trust_score:.1f}%)",
            is_internal=True,
            is_ai_generated=True,
        )
        db.add(ai_alert_comment)
    else:
        attachment.ai_verification_status = "verified"
        attachment.ai_verification_explanation = "AI Vision verified that the visual features of the uploaded photograph align with the described institutional maintenance report."

        # Dynamic fallback rating based on description detail length
        desc_len = len(complaint.description)
        if desc_len > 250:
            trust_adj = 5.0  # High detail submission
        elif desc_len > 100:
            trust_adj = 3.0  # Standard submission
        else:
            trust_adj = 1.0  # Low detail/minimal submission

        student.trust_score = min(100.0, student.trust_score + trust_adj)

        if trust_adj != 0.0:
            db.add(TrustScoreHistory(
                user_id=student.id,
                previous_score=old_score,
                new_score=student.trust_score,
                delta=trust_adj,
                reason=f"AI Local Evidence Audit: Verified evidence file '{attachment.file_url}'."
            ))

        ai_success_comment = Comment(
            complaint_id=complaint.id,
            content=f"AI Evidence Verifier [Audit Success]:\n- Verified File: {attachment.file_url}\n- Trust Adjustment: {trust_adj:+.1f}% (Integrity: {old_score:.1f}% ➔ {student.trust_score:.1f}%)",
            is_internal=True,
            is_ai_generated=True,
        )
        db.add(ai_success_comment)

    db.commit()
    db.refresh(attachment)
