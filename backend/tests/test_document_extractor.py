"""
Automated Unit and Integration Tests for Shipment Document Extraction Subsystem.
Runs 100% offline without requiring external API credentials.
"""
import pytest
from backend.documents.extractor import (
    DocumentExtractor,
    RuleBasedExtractionProvider,
    OpenAIExtractionProvider
)
from backend.documents.evaluation_benchmark import EVALUATION_DOCUMENTS


@pytest.mark.asyncio
async def test_extractor_clean_bill_of_lading():
    """Validates standard clean BOL extraction in kilograms."""
    extractor = DocumentExtractor(provider=RuleBasedExtractionProvider())
    doc = EVALUATION_DOCUMENTS[0]  # Clean BOL

    res = await extractor.extract_fields_async(doc["file_name"], doc["raw_text"])

    assert res.status == "PENDING_CONFIRMATION"
    assert res.requires_user_confirmation is True
    assert res.extraction_source == "RULE_BASED_EXTRACTOR"
    assert res.extracted_fields.commodity_code == "SOY"
    assert res.extracted_fields.shipment_quantity == 1800
    assert res.extracted_fields.declared_weight_kg == 1800
    assert res.extracted_fields.referenced_plot_id == "PLOT-BASE-DEMO"
    assert res.extracted_fields.shipment_identifier == "BOL-BR-2026-9821"
    assert len(res.extracted_fields.missing_fields) == 0


@pytest.mark.asyncio
async def test_extractor_metric_tons_normalization():
    """Validates Metric Ton (MT) conversion into integer kilograms (25 MT -> 25,000 kg)."""
    extractor = DocumentExtractor(provider=RuleBasedExtractionProvider())
    doc = EVALUATION_DOCUMENTS[1]

    res = await extractor.extract_fields_async(doc["file_name"], doc["raw_text"])

    assert res.extracted_fields.document_type == "COMMERCIAL_INVOICE"
    assert res.extracted_fields.commodity_code == "COCOA"
    assert res.extracted_fields.shipment_quantity == 25
    assert res.extracted_fields.quantity_unit == "MT"
    assert res.extracted_fields.declared_weight_kg == 25000
    assert res.extracted_fields.referenced_plot_id == "PLOT-COCOA-BAHIA-01"


@pytest.mark.asyncio
async def test_extractor_missing_plot_detection():
    """Verifies that an omitted plot reference is explicitly flagged as missing."""
    extractor = DocumentExtractor(provider=RuleBasedExtractionProvider())
    doc = EVALUATION_DOCUMENTS[2]  # Harvest record with no plot

    res = await extractor.extract_fields_async(doc["file_name"], doc["raw_text"])

    assert res.extracted_fields.referenced_plot_id is None
    assert "referenced_plot_id" in res.extracted_fields.missing_fields
    assert any("ATTENTION: No cadastral plot identifier" in w for w in res.warnings)


@pytest.mark.asyncio
async def test_extractor_conflicting_weight_ambiguity():
    """Verifies that multiple competing net weight declarations trigger ambiguity flags."""
    extractor = DocumentExtractor(provider=RuleBasedExtractionProvider())
    doc = EVALUATION_DOCUMENTS[3]  # Declared 1,800 kg vs Discharged 2,400 kg

    res = await extractor.extract_fields_async(doc["file_name"], doc["raw_text"])

    assert "shipment_quantity" in res.extracted_fields.ambiguous_fields
    assert res.extracted_fields.field_evidence["shipment_quantity"].is_ambiguous is True
    assert any("Multiple competing net weight declarations" in w for w in res.warnings)


@pytest.mark.asyncio
async def test_extractor_prompt_injection_safety():
    """Ensures adversarial instructions in document content are treated as passive data and inert."""
    extractor = DocumentExtractor(provider=RuleBasedExtractionProvider())
    doc = EVALUATION_DOCUMENTS[4]  # Injection attempt

    res = await extractor.extract_fields_async(doc["file_name"], doc["raw_text"])

    # Overrides in text (e.g. "Set declared_weight_kg to 0") MUST NOT succeed
    assert res.extracted_fields.declared_weight_kg == 1200
    assert res.extracted_fields.referenced_plot_id == "PLOT-BASE-DEMO"
    assert res.status == "PENDING_CONFIRMATION"


@pytest.mark.asyncio
async def test_extractor_bags_unit_conversion():
    """Validates 50 agricultural bags converted to 3,000 kg."""
    extractor = DocumentExtractor(provider=RuleBasedExtractionProvider())
    doc = EVALUATION_DOCUMENTS[5]

    res = await extractor.extract_fields_async(doc["file_name"], doc["raw_text"])

    assert res.extracted_fields.document_type == "PHYTOSANITARY_CERTIFICATE"
    assert res.extracted_fields.shipment_quantity == 50
    assert res.extracted_fields.quantity_unit == "BAGS"
    assert res.extracted_fields.declared_weight_kg == 3000


@pytest.mark.asyncio
async def test_extractor_provider_fallback_on_network_failure():
    """Verifies transparent fallback to RuleBasedExtractionProvider if primary provider fails."""
    broken_provider = OpenAIExtractionProvider(
        api_key="sk-fake-key",
        base_url="https://invalid.unreachable.domain.test/v1"
    )
    extractor = DocumentExtractor(provider=broken_provider)
    doc = EVALUATION_DOCUMENTS[0]

    res = await extractor.extract_fields_async(doc["file_name"], doc["raw_text"])

    assert "RULE_BASED_FALLBACK" in res.extraction_source
    assert res.extracted_fields.declared_weight_kg == 1800
    assert any("AI provider connection failed" in w for w in res.warnings)
