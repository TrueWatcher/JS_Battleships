# JS_Battleships
Yet another implementation of Battleship game in JavaScript and PHP (with Sqlite) for online playing

as of v.2.1.6 22 Mar 2017:
- you can install all files on your server and enjoy network playing (server must support Php >=5.5 with Sqlite3)
- you may play offline against local JS script even without server installation, just by copying all files to your local folder and opening index.html in browser
- allows to chose between several variants of rules before playing
- allows cheat mode when you can see enemy's ships (offline only)

as of v.2.1.23 20 Oct 2017:
- it looks stable now

Manual :)  

to install on the server:
That's so simple. Just copy all the files to your destination folder (may not be the site root). Check if it opens in browser and gives you index.html with Connect form.

to have a nice time with it:
- Enter your name after "Your name" and your opponent's name after "Your opponent's name", make sure you have typed them right, then press "Connect"
- Wait for him/her to enter his/her name after "Your name" and yours after "Your opponent's name" without typing errors and to also press "Connect". Soon after that you will see the Settings screen
- If you don't want to explore the settings, just scroll down to the "Confirm" button and press it 
- If you want to change something, click on the appropriate cell in the column under your name. Wait for you opponent to agree by clicking same row in his/her column. Press "Confirm"
- When you see two panels, draw you ships on the left one. The default is: 4 one-square ships, 3 two-square, 2 three-square and one four-square. They must be straight and not to touch each other. You may just press "Auto arrange"
- Press "Confirm". If the script tells you that your ships are not Ok, fix them and press "Confirm" again. Wait for your opponent to do the same
- When it's your move, you'll see "Make your move" under left panel. Do it by clicking on the right panel. By default settings, if you hit an enemy ship, you get one more move
- After finishing, you may press "Once more" to play again with same settings (the winner gets first move), or to press "New settings" to make new connect and new settings, or just close the window to exit

features:
- If something wrong happens on the screen, just reload the page in browser
- Client-server communication is done by AJAX requests. Polling interval when playing actively is 2s and some longer while on other screens. So this thing is not really fast, but works smoothly with old browsers and on most public hosters 

more features:
- Currently, there are no websockets support, no localizations, no registration, no games table and no plans to implement them. (But you can always get games.db from the root folder and explore it by any sqlite viewer)




