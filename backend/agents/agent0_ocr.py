"""
Agent 0: OCR Agent
Extracts nurse records from PDF documents using Groq Vision API.
"""

import os
import io
import json
import base64
import tempfile
from typing import List, Dict, Any
from pathlib import Path


def call_groq_vision(image_base64: str, mime_type: str = "image/png") -> str:
    """Call Groq Vision API with the given image."""
    try:
        from groq import Groq
    except ImportError:
        raise ImportError("groq not installed. Run: pip install groq")
    
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        raise ValueError("GROQ_API_KEY environment variable not set.")
    
    client = Groq(api_key=api_key)
    
    # Create data URL for the image
    image_data_url = f"data:{mime_type};base64,{image_base64}"
    
    response = client.chat.completions.create(
        model="meta-llama/llama-4-scout-17b-16e-instruct",   
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": """Extract all nurse records from this document.
Return ONLY a JSON array where each object has:
- name (string)
- skill (N1/N2/N3/N4)
- ward (ICU/ER/General/Pediatrics)
- unavailable_days (array of day strings like ["Monday", "Wednesday"])
- fatigue_score (integer 0-100)

If any field is missing, make a reasonable assumption.
Return ONLY the JSON array, no markdown, no explanation."""
                    },
                    {
                        "type": "image_url",
                        "image_url": {"url": image_data_url}
                    }
                ]
            }
        ],
        temperature=0.3,
        max_tokens=2048
    )
    
    return response.choices[0].message.content


def find_poppler_path() -> str:
    """Find Poppler installation path on Windows."""
    import os
    from pathlib import Path
    
    # Common installation paths to check
    possible_paths = [
        r"C:\Users\pangt\Downloads\poppler-25.12.0\Library\bin",
        r"C:\poppler\bin",
        r"C:\Program Files\poppler\bin",
        r"C:\Program Files (x86)\poppler\bin",
    ]
    
    # Also check if it's in PATH
    path_env = os.environ.get("PATH", "")
    for path in path_env.split(os.pathsep):
        if "poppler" in path.lower() and "bin" in path.lower():
            possible_paths.insert(0, path)  # Prioritize PATH entries
    
    for path in possible_paths:
        pdftoppm_exe = os.path.join(path, "pdftoppm.exe")
        if os.path.exists(pdftoppm_exe):
            return path
    
    return None


def pdf_to_base64_images(pdf_path: str) -> List[str]:
    """Convert PDF pages to base64-encoded PNG images."""
    try:
        from pdf2image import convert_from_path
    except ImportError:
        raise ImportError("pdf2image not installed. Run: pip install pdf2image")
    
    try:
        from PIL import Image
    except ImportError:
        raise ImportError("PIL not installed. Run: pip install Pillow")
    
    # Find Poppler path
    poppler_path = find_poppler_path()
    
    try:
        if poppler_path:
            images = convert_from_path(pdf_path, dpi=200, poppler_path=poppler_path)
        else:
            images = convert_from_path(pdf_path, dpi=200)
    except Exception as e:
        if "poppler" in str(e).lower() or "pdftoppm" in str(e).lower():
            raise RuntimeError(
                "Poppler is not installed or not found. pdf2image requires Poppler to convert PDFs.\n"
                "Windows: Download from https://github.com/oschwartz10612/poppler-windows/releases/\n"
                "        Extract to C:\\poppler and add C:\\poppler\\Library\\bin to PATH\n"
                "macOS: brew install poppler\n"
                "Linux: sudo apt-get install poppler-utils"
            )
        raise
    
    base64_images = []
    
    for image in images:
        buffer = io.BytesIO()
        image.save(buffer, format="PNG")
        image_bytes = buffer.getvalue()
        base64_str = base64.b64encode(image_bytes).decode("utf-8")
        base64_images.append(base64_str)
    
    return base64_images


class OCRAgent:
    """AI Agent for extracting nurse records from PDF documents."""
    
    def extract(self, pdf_path: str) -> List[Dict[str, Any]]:
        """
        Extract nurse records from a PDF file.
        
        Args:
            pdf_path: Path to the PDF file
        
        Returns:
            List of nurse dicts with name, skill, ward, unavailable_days, fatigue_score
        """
        try:
            # Convert PDF to images
            base64_images = pdf_to_base64_images(pdf_path)
            
            all_nurses = []
            
            # Process each page
            for i, image_base64 in enumerate(base64_images):
                print(f"Processing page {i + 1}/{len(base64_images)}...")
                response = call_groq_vision(image_base64)
                
                # Extract JSON from response
                text = response.strip()
                if "```json" in text:
                    text = text.split("```json")[1].split("```")[0].strip()
                elif "```" in text:
                    text = text.split("```")[1].split("```")[0].strip()
                
                page_nurses = json.loads(text)
                if isinstance(page_nurses, list):
                    all_nurses.extend(page_nurses)
            
            return all_nurses
            
        except Exception as e:
            print(f"OCR extraction failed: {e}")
            # Re-raise the error instead of falling back to mock data
            # so the user knows what's wrong
            raise RuntimeError(f"PDF extraction failed: {str(e)}")
    
    def _fallback_nurses(self) -> List[Dict[str, Any]]:
        """Return hardcoded sample nurse data as fallback."""
        return [
            {"name": "Zhang Wei", "skill": "N4", "ward": "ICU", "unavailable_days": ["Saturday", "Sunday"], "fatigue_score": 35},
            {"name": "Li Hua", "skill": "N3", "ward": "ICU", "unavailable_days": [], "fatigue_score": 45},
            {"name": "Wang Fang", "skill": "N3", "ward": "ER", "unavailable_days": ["Monday"], "fatigue_score": 55},
            {"name": "Liu Ming", "skill": "N2", "ward": "ER", "unavailable_days": [], "fatigue_score": 40},
            {"name": "Chen Jing", "skill": "N2", "ward": "General", "unavailable_days": ["Wednesday"], "fatigue_score": 60},
            {"name": "Yang Li", "skill": "N1", "ward": "General", "unavailable_days": [], "fatigue_score": 30},
            {"name": "Zhao Qiang", "skill": "N4", "ward": "ICU", "unavailable_days": ["Friday"], "fatigue_score": 50},
            {"name": "Wu Ying", "skill": "N3", "ward": "Pediatrics", "unavailable_days": [], "fatigue_score": 42},
        ]


# FastAPI endpoint
from fastapi import FastAPI, File, UploadFile
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="OCR Agent API", description="Extract nurse records from PDF documents")

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    """
    Upload a PDF file and extract nurse records.
    
    Returns:
        JSON array of nurse records
    """
    # Validate file type
    if not file.filename.endswith(".pdf"):
        return JSONResponse(
            status_code=400,
            content={"error": "Only PDF files are supported"}
        )
    
    # Save uploaded file temporarily
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name
    
    try:
        # Extract nurses using OCRAgent
        agent = OCRAgent()
        nurses = agent.extract(tmp_path)
        
        return {"nurses": nurses, "count": len(nurses)}
        
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": str(e)}
        )
        
    finally:
        # Clean up temp file
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


if __name__ == "__main__":
    # Test with a sample PDF
    import sys
    
    # Create a sample PDF for testing
    print("=" * 60)
    print("OCR AGENT TEST")
    print("=" * 60)
    
    # Check if PDF path provided
    if len(sys.argv) > 1:
        pdf_path = sys.argv[1]
        if not os.path.exists(pdf_path):
            print(f"Error: File not found: {pdf_path}")
            sys.exit(1)
    else:
        # Create a sample PDF for testing
        print("No PDF provided. Creating sample PDF for testing...")
        
        try:
            from reportlab.pdfgen import canvas
            from reportlab.lib.pagesizes import letter
        except ImportError:
            print("reportlab not installed. Run: pip install reportlab")
            print("\nUsing fallback data instead...")
            agent = OCRAgent()
            nurses = agent._fallback_nurses()
            print("\nFALLBACK NURSE DATA:")
            print(json.dumps(nurses, indent=2, ensure_ascii=False))
            sys.exit(0)
        
        # Create sample PDF
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            pdf_path = tmp.name
        
        c = canvas.Canvas(pdf_path, pagesize=letter)
        c.drawString(100, 750, "Nurse Roster - March 2026")
        c.drawString(100, 720, "=" * 50)
        
        nurses_text = """
Name: Zhang Wei | Skill: N4 | Ward: ICU | Unavailable: Sat, Sun | Fatigue: 35
Name: Li Hua | Skill: N3 | Ward: ICU | Unavailable: None | Fatigue: 45
Name: Wang Fang | Skill: N3 | Ward: ER | Unavailable: Mon | Fatigue: 55
Name: Liu Ming | Skill: N2 | Ward: ER | Unavailable: None | Fatigue: 40
Name: Chen Jing | Skill: N2 | Ward: General | Unavailable: Wed | Fatigue: 60
Name: Yang Li | Skill: N1 | Ward: General | Unavailable: None | Fatigue: 30
Name: Zhao Qiang | Skill: N4 | Ward: ICU | Unavailable: Fri | Fatigue: 50
Name: Wu Ying | Skill: N3 | Ward: Pediatrics | Unavailable: None | Fatigue: 42
        """.strip()
        
        y = 680
        for line in nurses_text.split("\n"):
            c.drawString(100, y, line.strip())
            y -= 20
        
        c.save()
        print(f"Sample PDF created: {pdf_path}")
    
    # Run extraction
    print("\nExtracting nurse records...")
    agent = OCRAgent()
    nurses = agent.extract(pdf_path)
    
    print("\n" + "=" * 60)
    print("EXTRACTED NURSES:")
    print("=" * 60)
    print(json.dumps(nurses, indent=2, ensure_ascii=False))
    print(f"\nTotal nurses extracted: {len(nurses)}")
    
    # Clean up temp file if we created one
    if len(sys.argv) <= 1 and os.path.exists(pdf_path):
        os.remove(pdf_path)
        print(f"\nCleaned up temp file: {pdf_path}")
