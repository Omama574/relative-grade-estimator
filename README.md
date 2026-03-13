# VIT Relative Grade Estimator

A Chrome extension that enhances the VIT VTOP marks page by displaying relative grade statistics such as mean, standard deviation, grade ranges, and estimated grade based on anonymous, student-submitted marks.

## How it works

- **Extraction**: Runs on the VIT VTOP "Digital Assignment and Marks" page. It extracts marks for theory courses.
- **Anonymization**: Your Register Number is hashed locally (SHA-256) before leaving your browser. Only the anonymous hash is sent to the server.
- **Aggregation**: The backend collects these anonymous marks and calculates the class mean and standard deviation.
- **Visualization**: The extension fetches these statistics and injects a relative grading table directly below each course on the VTOP page.

## Privacy & Transparency (Open Source)

This project is open-source to ensure students can verify how their data is handled:
- **No Personal Data**: We do not collect names, passwords, or raw register numbers. 
- **Local Hashing**: The register number is converted into a unique but anonymous alphanumeric string (hash) using SHA-256 before transmission.
- **Limited Scope**: The extension only requests data for course marks and has no access to your session or credentials.

## Technical Stack

- **Extension**: Vanilla JavaScript (Manifest V3)
- **Backend**: Node.js & Express
- **Database**: PostgreSQL (hosted on Railway)

## Deployment (For Developers)

1. **Backend**: Host the `backend` folder on a service like Railway.
2. **Database**: Provision a PostgreSQL instance and provide the `DATABASE_URL` env variable.
3. **Extension Configuration**:
   - Update the `BACKEND_URL` in `extension/background.js` and `extension/content.js`.
   - Load the `extension` folder into Chrome via "Load unpacked" in `chrome://extensions/`.

## Disclaimer

This extension is not affiliated with or endorsed by VIT University. It is a student-built academic utility. Use at your own discretion.
