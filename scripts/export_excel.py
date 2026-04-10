import sqlite3
import openpyxl
import os

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'ttit.db')

def export_to_excel():
    if not os.path.exists(DB_PATH):
        print(f"Database {DB_PATH} not found/created yet!")
        return

    conn = sqlite3.connect(DB_PATH)
    wb = openpyxl.Workbook()
    wb.remove(wb.active) # Remove default 'Sheet1'
    
    tables = [
        "entities", "financials", "donors", "policy_papers", 
        "legislation", "influence_links", "lobbying", 
        "govt_contracts", "media_coverage", "analysis_verdicts"
    ]
    
    for tab in tables:
        ws = wb.create_sheet(title=tab)
        cur = conn.cursor()
        try:
            cur.execute(f"SELECT * FROM {tab}")
            rows = cur.fetchall()
            headers = [desc[0] for desc in cur.description] if cur.description else []
            ws.append(headers)
            for row in rows:
                ws.append(list(row))
            print(f"Successfully serialized native SQLite data into -> {tab}")
        except sqlite3.OperationalError:
            print(f"Ignored: Table {tab} not present/defined in native scope.")
            
    output_file = os.path.join(os.path.dirname(__file__), '..', 'ttit_database_export.xlsx')
    wb.save(output_file)
    conn.close()
    print(f"Database dumped fully into portable excel spreadsheet: {output_file}")

if __name__ == "__main__":
    export_to_excel()
