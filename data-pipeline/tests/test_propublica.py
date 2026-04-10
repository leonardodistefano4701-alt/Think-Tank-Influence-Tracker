import pytest
import sys
import os

# Put src in path so Propublica sees internal modules
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'src'))
from collectors.propublica import process_990_data

def test_process_990_data_empty():
    res = process_990_data("123", {})
    assert len(res) == 0

def test_process_990_data_none():
    res = process_990_data("123", None)
    assert len(res) == 0

def test_process_990_data_valid():
    mock_data = {
        "filings_with_data": [
            {
                "tax_prd_yr": 2021,
                "totrevenue": 1000,
                "totfuncexpns": 800,
                "totassetsend": 5000,
                "totprgmrevnue": 100,
                "totcntrbgfts": 900,
                "invstmntinc": 0
            }
        ]
    }
    
    financials = process_990_data("uuid-123", mock_data)
    assert len(financials) == 1
    assert financials[0].fiscal_year == 2021
    assert financials[0].total_revenue == 1000
    assert financials[0].total_expenses == 800
    assert financials[0].net_assets == 5000
    assert financials[0].program_revenue == 100
    assert financials[0].contributions_and_grants == 900
    assert financials[0].investment_income == 0
    assert financials[0].raw_990 is not None
