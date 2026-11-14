-- Three more homepage reviews, after the original Arun Kumar row (sort_order 0).

INSERT INTO "testimonials" (
    "id",
    "customer_name",
    "location",
    "quote",
    "rating",
    "sort_order",
    "status",
    "published_at",
    "created_at",
    "updated_at"
) VALUES
(
    'cmseedreview00000000000002',
    'Priya Menon',
    'Anna Nagar',
    'The interior painting looks fresh and even. The team covered the furniture and left the house clean.',
    5,
    1,
    'PUBLISHED',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
),
(
    'cmseedreview00000000000003',
    'Karthik V',
    'Tambaram',
    'They fixed a leaking bathroom pipe the same week we called. The quote was clear and there were no surprises.',
    5,
    2,
    'PUBLISHED',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
),
(
    'cmseedreview00000000000004',
    'Lakshmi N',
    'Adyar',
    'Good carpentry repair on our kitchen cabinets. The finish matches the rest of the woodwork.',
    4,
    3,
    'PUBLISHED',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);
