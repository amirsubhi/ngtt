-- Reset legal page bodies to use installer template markers.
-- Migration 025 hardcoded "NGTT" content; this restores the proper
-- [SITE NAME] / [CONTACT EMAIL] / [DMCA EMAIL] markers so the installer
-- can fill them in on a fresh run, and admins know what to replace.

UPDATE custom_pages SET body = 'Terms and Conditions

Last updated: [DATE]

1. Acceptance of Terms

By accessing or using [SITE NAME] ("the Site"), you agree to be bound by these Terms and Conditions. If you do not agree, do not use the Site. The Site reserves the right to update these terms at any time without prior notice. Continued use of the Site after changes constitutes acceptance of the revised terms.

2. Eligibility and Membership

Access to the Site is by invitation only. You must be at least 18 years of age to register. You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account. You may not share, sell, or transfer your account to any other person.

3. Acceptable Use

You agree not to use the Site to:

  a. Upload, share, or distribute content that infringes any third-party copyright, trademark, patent, trade secret, or other intellectual property right.
  b. Upload, share, or distribute child sexual abuse material (CSAM) or any content that exploits or harms minors.
  c. Distribute malware, spyware, ransomware, or any malicious software.
  d. Harass, threaten, or abuse other members.
  e. Attempt to gain unauthorized access to any part of the Site or its infrastructure.

4. Content and Torrents

The Site is a meta-index and tracker. We do not host or transmit the actual content referenced by torrent files. Uploaders are solely responsible for ensuring they have the right to distribute any content they upload.

5. Ratio Requirements

Members are expected to maintain a minimum upload/download ratio as specified in the Site rules. Failure to meet ratio requirements may result in restricted access, account warnings, or termination.

6. Account Termination

The Site reserves the right to suspend or terminate any account, at any time, with or without notice, for conduct that violates these Terms or for any other reason at our sole discretion.

7. Disclaimer of Warranties

THE SITE IS PROVIDED "AS IS" WITHOUT WARRANTY OF ANY KIND. WE DO NOT WARRANT THAT THE SITE WILL BE UNINTERRUPTED OR ERROR-FREE.

8. Limitation of Liability

TO THE FULLEST EXTENT PERMITTED BY LAW, THE SITE AND ITS OPERATORS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, OR CONSEQUENTIAL DAMAGES ARISING FROM YOUR USE OF THE SITE.

9. Contact

For general inquiries, contact: [CONTACT EMAIL]' WHERE slug = 'terms';

UPDATE custom_pages SET body = 'DMCA Copyright Policy

Last updated: [DATE]

1. Overview

[SITE NAME] respects the intellectual property rights of others and expects users to do the same. In accordance with the Digital Millennium Copyright Act of 1998 ("DMCA"), 17 U.S.C. § 512, the Site will respond expeditiously to claims of copyright infringement.

2. Designated DMCA Agent

To submit a copyright infringement notice, contact our designated agent:

  DMCA Agent: DMCA Agent
  Email:      [DMCA EMAIL]

3. How to Submit a Takedown Notice

Your written notice must include ALL of the following:

  a. A physical or electronic signature of the copyright owner or authorized representative.
  b. Identification of the copyrighted work claimed to have been infringed.
  c. Identification of the material on the Site that you claim is infringing (e.g. the full URL of the torrent page).
  d. Your contact information — name, address, telephone number, and email address.
  e. A good faith statement that the use of the material is not authorized by the copyright owner, its agent, or the law.
  f. A statement under penalty of perjury that the information is accurate and that you are authorized to act on behalf of the copyright owner.

Notices that do not satisfy all requirements may be disregarded. False notices may expose the sender to liability under 17 U.S.C. § 512(f).

4. Our Response

Upon receipt of a valid takedown notice, we will remove or disable access to the identified torrent listing, notify the uploader, and document the notice for our repeat infringer records.

5. Counter-Notice

If you believe your content was removed by mistake, you may submit a counter-notice to our DMCA Agent containing your signature, identification of the removed material, a good faith statement under penalty of perjury, your contact details, and consent to federal court jurisdiction. If the complainant does not file a court action within 10-14 business days, we may reinstate the removed material.

6. Repeat Infringer Policy

The Site will terminate accounts of users who are repeat infringers in appropriate circumstances.

7. Contact

All DMCA correspondence: [DMCA EMAIL]
General inquiries: [CONTACT EMAIL]' WHERE slug = 'dmca';

UPDATE custom_pages SET body = 'Support & Help

Welcome to [SITE NAME]. This page covers the most common questions and how to get help.

Getting Started
---------------
After logging in, use the Browse page to find torrents. Download the .torrent file or copy the magnet link into your torrent client. Make sure your client is configured to use your personal announce URL — found in Settings under your profile.

Maintaining Your Ratio
----------------------
Your ratio is your total uploaded bytes divided by your total downloaded bytes. A healthy ratio is above 1.0. Seed your downloads for as long as possible after they complete. Freeleech torrents do not count against your downloaded total.

If your ratio drops below the minimum threshold, your download privileges may be limited. Check the Site Rules page for the current minimum.

Account Issues
--------------
  - Forgot your password? Use the Forgot Password link on the login page.
  - Need to change your email or username? Go to Settings.
  - Lost your two-factor authentication device? Contact support (see below).
  - Account banned? You will have received a reason by email or on login.

Reporting Problems
------------------
  - Broken torrent or bad content: use the Report button on the torrent page.
  - DMCA / copyright concern: see our DMCA Policy at /p/dmca.
  - Staff or site issue: open a ticket via the Helpdesk.

Contact
-------
For support enquiries not covered above, email: [CONTACT EMAIL]
Please include your username and a clear description of the issue.' WHERE slug = 'support';
