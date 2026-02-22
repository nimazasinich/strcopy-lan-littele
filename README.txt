SMARTCOPY - WINDOWS HUB DEPLOYMENT GUIDE
========================================

1. PREREQUISITES
----------------
- Node.js (LTS version) installed on the Windows Hub.
- Admin privileges to create folders on C:\ drive.

2. INITIAL SETUP
----------------
- Copy the project folder to the Windows Hub.
- Open a terminal in the project folder and run:
  npm install
  npm run setup

- The setup script will:
  * Create C:\SmartCopy\Archive folder structure.
  * Initialize the SQLite database.
  * Create logs directory.

3. ADDING CONTENT
-----------------
- Place your movie files in: C:\SmartCopy\Archive\Movies
- Place your series folders in: C:\SmartCopy\Archive\Series
- To register them in the system, you can manually add entries to 'backend/database/smartcopy.db' using a SQLite browser, or use the upcoming Admin Content Manager (Beta).

4. STARTING THE SYSTEM
----------------------
- Double-click 'start-system.bat' to launch the server.
- The console will display the Local IP address (e.g., 192.168.1.50).
- Admin Panel: http://[LOCAL_IP]:3000/admin
- Customer View: http://[LOCAL_IP]:3000/

5. AUTO-START ON WINDOWS
------------------------
- To run on startup, press Win+R, type 'shell:startup', and place a shortcut to 'start-system.bat' in that folder.
- Alternatively, use PM2:
  npm install -g pm2
  pm2 start server.ts --interpreter tsx --name smartcopy
  pm2 save
  pm2 startup

6. TROUBLESHOOTING
------------------
- Logs are stored in the 'logs/' folder.
- Check 'logs/error.log' for any system crashes.
- If the Local IP changes, the QR codes will update automatically on the next refresh.

7. DATABASE RESET
-----------------
- To reset the system, delete 'backend/database/smartcopy.db' and run 'npm run setup' again.

Developed for SmartCopy Hub v1.0
