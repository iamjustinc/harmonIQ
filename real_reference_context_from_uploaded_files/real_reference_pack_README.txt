Real-file-derived reference context for harmonIQ

Use these instead of the earlier synthetic sample pack.

What I found:
- cleaned_crm_export(1).csv is internally consistent with transformation_log(1).csv
- the 12 records missing from cleaned output are intentional duplicate exclusions
- state/email/name fixes mostly line up
- owner assignment does NOT support simple state+segment routing rules:
  many state+segment combinations map to multiple different owners

Recommendation:
1. Use the cleaned export as the trusted reference export
2. Do NOT use broad ownership rules derived only from state+segment
3. Only infer owner from:
   - exact domain/account matches in the clean reference
   - explicit uploaded ownership rules you trust
4. Otherwise return "Unassigned - Review" / manual review required

Files:
- real_clean_crm_reference_from_cleaned.csv
- real_ownership_rules_from_cleaned.csv  (use cautiously; many patterns are ambiguous)
- real_segment_dictionary_from_cleaned.csv
