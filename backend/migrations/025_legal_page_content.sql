-- Pre-populate body content for the three legal/support pages.
-- Uses UPDATE ... WHERE body = '<placeholder>' so re-running after an admin
-- has edited the content will not overwrite their changes.

UPDATE custom_pages SET body = 'TERMS OF SERVICE
Last updated: 2026-01-01

Welcome to NGTT. By creating an account or accessing this site you agree to the following terms. If you do not agree, do not use the service.

1. ELIGIBILITY
Membership is by invitation only. You must be at least 18 years old to register. Sharing your invitation link publicly or with bots is grounds for immediate ban.

2. ACCOUNT RULES
Each person may hold one account. Account sharing is strictly prohibited — your account credentials are personal and non-transferable. You are responsible for all activity that occurs under your account. Report any unauthorised access immediately via the helpdesk.

3. RATIO AND SEEDING
NGTT operates a ratio-enforced community. You are expected to seed what you download. The minimum seeding requirement is posted in the site rules. Accounts with a ratio below the threshold for an extended period are subject to warning and eventual suspension. Freeleech items are exempt from ratio calculations.

4. ACCEPTABLE USE
You may not upload, share, or index any content that:
- Infringes copyright or other intellectual property rights
- Depicts illegal sexual content involving minors
- Contains malware, trojans, or other malicious software
- Is deliberately mislabelled to deceive other members

All uploads are reviewed before being made public. Staff may reject or remove any upload at their discretion.

5. CONDUCT
Harassment, threats, doxxing, or hate speech directed at any member or staff is grounds for immediate permanent ban. Treat all members with respect. The forum and shoutbox are subject to the same rules as the rest of the site.

6. FLUX (SITE CURRENCY)
Flux points are a virtual site currency. They have no monetary value, are non-transferable, and may be modified or removed by staff at any time without compensation.

7. ACCOUNT TERMINATION
Staff may suspend or permanently ban any account that violates these terms, at their sole discretion and without notice. Banned accounts forfeit all data including uploaded torrents, flux balance, and forum posts.

8. DISCLAIMER
NGTT is provided as-is. We make no warranties regarding uptime, data preservation, or fitness for any purpose. We are not liable for any damages arising from your use of the site.

9. CHANGES
These terms may be updated at any time. Continued use of the site after an update constitutes acceptance of the revised terms. Material changes will be announced via the site news.' WHERE slug = 'terms' AND body = 'Terms of service content goes here.';

UPDATE custom_pages SET body = 'DMCA POLICY
Last updated: 2026-01-01

NGTT responds to notices of alleged copyright infringement in accordance with the Digital Millennium Copyright Act (DMCA), 17 U.S.C. § 512.

1. REPORTING INFRINGEMENT
If you believe that content indexed on NGTT infringes your copyright, you may submit a written notice to our designated agent. Your notice must include:

(a) A physical or electronic signature of the copyright owner or authorised representative.
(b) Identification of the copyrighted work claimed to have been infringed.
(c) Identification of the material claimed to be infringing, with enough detail for us to locate it (e.g. the torrent URL or info-hash).
(d) Your contact information: name, address, telephone number, and email address.
(e) A statement that you have a good faith belief that use of the material is not authorised by the copyright owner, its agent, or the law.
(f) A statement, under penalty of perjury, that the information in your notice is accurate and that you are the copyright owner or are authorised to act on their behalf.

Send completed notices to the contact address listed on our Support page, with the subject line "DMCA Takedown Notice".

2. HOW WE RESPOND
Upon receiving a valid DMCA notice we will:
- Remove or disable access to the identified torrent within a reasonable time.
- Notify the uploader that the content has been taken down.
- Log the notice for our repeat-infringer records.

We may request additional information to verify the validity of a notice before acting.

3. COUNTER-NOTICE
If you believe your content was removed in error, you may submit a counter-notice containing:

(a) Your physical or electronic signature.
(b) Identification of the removed material and its prior location on the site.
(c) A statement under penalty of perjury that you have a good faith belief the material was removed by mistake or misidentification.
(d) Your name, address, and telephone number.
(e) Consent to jurisdiction of the federal court in your district and agreement to accept service of process from the original complainant.

Upon receipt of a valid counter-notice, we may restore the content after 10-14 business days unless the complainant files a court action.

4. REPEAT INFRINGERS
NGTT maintains a policy of terminating accounts of users who are repeat copyright infringers, in appropriate circumstances.

5. ABUSE
Submitting a false DMCA notice is perjury and may result in legal liability. We reserve the right to seek damages from parties who abuse this process.' WHERE slug = 'dmca' AND body = 'DMCA policy content goes here.';

UPDATE custom_pages SET body = 'SUPPORT
Need help? There are several ways to get in touch.

HELPDESK (RECOMMENDED)
The primary support channel is the built-in helpdesk, accessible from your account menu. Open a ticket and a staff member will respond as soon as possible. Please include as much detail as you can — screenshots, torrent names, error messages — so we can help you faster.

Response times vary. Staff are volunteers operating across multiple time zones. Most tickets are resolved within 24-48 hours.

FORUM
For general questions that may benefit other members, post in the Help & Support section of the forum. Community members and staff both monitor the forum.

SHOUTBOX
The shoutbox is for casual chat only. Staff will not provide account support via the shoutbox. Repeated support requests in the shoutbox may result in a warning.

WHAT WE CAN HELP WITH
- Account issues (password reset, email change, 2FA problems)
- Ratio disputes or bonus point queries
- Torrent problems (bad files, missing content, mislabelled releases)
- Reporting rule-breaking members or content
- Invite or registration questions
- Technical issues with the site

WHAT WE CANNOT HELP WITH
- Restoring permanently banned accounts (bans are final unless appealed via ticket within 7 days)
- BitTorrent client configuration — consult your client documentation
- Content requests — use the Requests section of the site

DMCA AND LEGAL
For copyright matters please refer to our DMCA Policy page.' WHERE slug = 'support' AND body = 'Support content goes here.';
