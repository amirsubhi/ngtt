INSERT IGNORE INTO site_settings (`key`, value, type, `group`, label, description)
VALUES (
  'bad_words',
  '["fuck","fucker","fucking","motherfucker","shit","bullshit","cunt","dick","cock","pussy","bitch","slut","whore","asshole","arsehole","bastard","faggot","fag","nigger","nigga","retard","piss"]',
  'json',
  'moderation',
  'Bad Word List',
  'JSON array of words to filter in shoutbox and forum. Matched words are replaced with asterisks.'
)
