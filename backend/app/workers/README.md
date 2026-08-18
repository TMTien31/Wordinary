# Workers

Reserved for future background entry points such as PDF processing, caption
imports, and batch analysis.

Worker tasks should call module services. They should not own business rules or
write directly around repositories.
