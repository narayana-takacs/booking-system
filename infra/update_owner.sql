update "user"
set email = 'provider@example.com',
    "firstName" = 'Provider',
    "lastName" = 'Owner',
    password = '$2b$12$enKr1O1u7ACX0DsGAqYJDeg9.CnH91gcjWHscNLAKuq2bwRim67Qu',
    "personalizationAnswers" = '{}'::json,
    settings = '{"userActivated": true}'::json,
    "updatedAt" = current_timestamp
where "roleSlug" = 'global:owner';
