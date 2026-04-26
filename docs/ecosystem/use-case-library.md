# GovOps Use Case Library

Programs and services across government domains where GovOps can be applied. Each entry describes the program, why it fits, and the key rules that would be encoded.

---

## Social Benefits

### Pension Eligibility (demonstrated in demo)
- **Countries**: Canada (OAS), Brazil (INSS), Spain, France, Germany, Ukraine
- **Rules**: age thresholds, contribution periods, residency requirements, partial calculations
- **Volume**: millions of cases per year in most countries
- **Why it fits**: clear statutory thresholds, high volume, standardized evidence

### Disability Determination
- **Examples**: Canada (CPP-D), US (SSDI), UK (PIP), Germany (Schwerbehindertenrecht)
- **Rules**: medical criteria, functional capacity, work history, degree of disability
- **Why it fits**: structured assessment criteria, high appeal rates (traceability critical)
- **Complexity**: higher than pension — medical evidence is less deterministic

### Child and Family Benefits
- **Examples**: Canada (CCB), UK (Child Benefit), Australia (Family Tax Benefit)
- **Rules**: age of children, household income, custody arrangements, residency
- **Why it fits**: high volume, means-tested calculations, frequent reassessment

### Social Assistance / Welfare
- **Examples**: income support, housing benefit, food assistance
- **Rules**: income thresholds, household composition, asset limits, work requirements
- **Why it fits**: complex eligibility with multiple interacting conditions

---

## Immigration and Citizenship

### Visa Eligibility Screening
- **Rules**: purpose of travel, financial sufficiency, health requirements, security checks
- **Why it fits**: checklist-driven, high volume, standardized forms

### Permanent Residency Assessment
- **Rules**: points-based systems, sponsorship criteria, work experience, language proficiency
- **Why it fits**: deterministic scoring with clear thresholds

### Citizenship Application
- **Rules**: residency duration, language requirements, knowledge tests, criminal record checks
- **Why it fits**: statutory criteria with clear conditions

---

## Tax Administration

### Tax Filing Compliance
- **Rules**: filing deadlines, required forms, deduction eligibility, penalty calculations
- **Why it fits**: highly deterministic, formula-based, high volume

### Tax Credit Eligibility
- **Rules**: income thresholds, qualifying expenses, program-specific criteria
- **Why it fits**: clear statutory calculations with evidence requirements

---

## Permits and Licensing

### Business License Screening
- **Rules**: zoning compliance, insurance requirements, qualification checks
- **Why it fits**: checklist-driven, standardized across applicants

### Building Permit Review
- **Rules**: code compliance, setback requirements, environmental constraints
- **Why it fits**: deterministic rule evaluation against published standards

### Professional Licensing
- **Rules**: education requirements, examination scores, experience hours, continuing education
- **Why it fits**: clear threshold criteria with evidence requirements

---

## Healthcare Administration

### Drug Formulary Coverage
- **Rules**: diagnostic criteria, prior authorization requirements, step therapy protocols
- **Why it fits**: clinical criteria are increasingly codified in guidelines

### Hospital Bed Allocation
- **Rules**: acuity scoring, wait time thresholds, geographic catchment
- **Why it fits**: rule-based triage with accountability requirements

---

## Education

### Student Financial Aid
- **Rules**: enrollment status, income thresholds, academic standing, program eligibility
- **Why it fits**: means-tested with clear statutory criteria

### School Enrollment and Transfer
- **Rules**: catchment boundaries, sibling priority, special needs placement
- **Why it fits**: rule-based allocation with transparency requirements

---

## Justice and Compliance

### Parole Eligibility Screening
- **Rules**: time served, offense category, risk assessment criteria, program completion
- **Why it fits**: statutory criteria with high accountability requirements

### Regulatory Compliance Assessment
- **Rules**: reporting deadlines, emission thresholds, safety standards
- **Why it fits**: checklist-driven against published regulations

---

## Disaster and Emergency

### Disaster Relief Eligibility
- **Rules**: geographic zone, damage assessment, income thresholds, prior assistance
- **Why it fits**: high volume during crisis, need for speed with accountability

### Internally Displaced Person (IDP) Assistance
- **Rules**: displacement verification, residency history, family composition, vulnerability scoring
- **Why it fits**: critical for post-conflict reconstruction (see Ukraine use case)

---

## Selection Criteria

The strongest GovOps candidates share these properties:

| Property | Why It Matters |
|----------|---------------|
| **High volume** | ROI is proportional to case count |
| **Clear statutory basis** | Rules must come from law, not discretion |
| **Standardized evidence** | Documents are predictable and structured |
| **Measurable backlog** | Current pain is visible and quantifiable |
| **Low political risk** | Safer for first deployment |
| **Existing digital records** | Less document ingestion work |
| **High audit/appeal burden** | Traceability provides immediate value |

---

## Contributing Use Cases

If your government program fits the GovOps model, submit a [New Jurisdiction issue](https://github.com/your-org/61-GovOps/issues/new?template=new_jurisdiction.md) with the program details. The community can help encode the rules.
