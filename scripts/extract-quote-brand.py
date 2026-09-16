"""Extract only the existing business logo, never customer data, from the supplied quote."""
from pathlib import Path
from pypdf import PdfReader
import sys

source = PdfReader(sys.argv[1])
logo = next(image for image in source.pages[0].images if image.image.size == (398, 418))
target = Path(__file__).resolve().parents[1] / 'public' / 'brand' / 'luxus-logo.jpg'
target.parent.mkdir(parents=True, exist_ok=True)
target.write_bytes(logo.data)
print('Extracted existing Luxus logo only.')
