import pdfplumber

def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extract text content from a PDF file preserving structure where possible."""
    text_content = []
    import io
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        for page in pdf.pages:
            extracted = page.extract_text()
            if extracted:
                text_content.append(extracted)
    return "\n\n".join(text_content)
