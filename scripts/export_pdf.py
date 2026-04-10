from fpdf import FPDF
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'ttit.db')

def generate_pdf():
    if not os.path.exists(DB_PATH):
        print(f"Database {DB_PATH} not found/created yet!")
        return

    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Helvetica", size=24, style="B")
    pdf.cell(200, 15, txt="TTIT Structural Intelligence Report", ln=True, align="C")
    
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    
    pdf.set_font("Helvetica", size=14, style="B")
    pdf.cell(200, 15, txt="Forensically Tracked Think Tanks:", ln=True)
    
    pdf.set_font("Helvetica", size=12)
    try:
        cur.execute("SELECT name, lean FROM entities WHERE type='think_tank'")
        for row in cur.fetchall():
            pdf.cell(200, 10, txt=f"   -> {row[0]} (Axis: {row[1]})", ln=True)
    except sqlite3.OperationalError:
        pdf.cell(200, 10, txt="(No pipeline structurally scraped natively yet)", ln=True)
        
    pdf.set_font("Helvetica", size=14, style="B")
    pdf.cell(200, 15, txt="Media Amplifier Nodes:", ln=True)
    
    pdf.set_font("Helvetica", size=12)
    try:
        cur.execute("SELECT name, lean FROM entities WHERE type='media_amplifier'")
        for row in cur.fetchall():
            pdf.cell(200, 10, txt=f"   -> {row[0]} (Axis: {row[1]})", ln=True)
    except sqlite3.OperationalError:
        pass
        
    output = os.path.join(os.path.dirname(__file__), '..', 'TTIT_Export_Report.pdf')
    pdf.output(output)
    conn.close()
    print(f"Structural PDF Profile Dumped -> {output}")

if __name__ == "__main__":
    generate_pdf()
