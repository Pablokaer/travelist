# data-pipeline

Python ingestion for Wayfarer's reference data (attractions, countries, visa rules).
Ingestion itself lands in milestone M2; M0 provides the package, config validation and tests.

```bash
cd data-pipeline
python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"

python -m wayfarer_pipeline validate-config
python -m wayfarer_pipeline ingest --city lisbon   # M2
python -m wayfarer_pipeline ingest --all           # M2

pytest && ruff check .
```

Cities are defined in [`cities.yaml`](./cities.yaml). Adding a city = add an entry + run ingestion.
