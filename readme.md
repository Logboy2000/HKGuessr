![Logo](images/logo.png)

Hollow Guessr is an open-source GeoGuessr web game set in the worlds of Hollow Knight and Silksong. 

The game is written in vanilla HTML, JS, and CSS; no fancy frameworks or build tools.

Play it live at [https://hollowguessr.pages.dev](https://hollowguessr.pages.dev/)



## Core Features:
### Multiple Image Packs

Includes Hallownest and Pharloom along with other user submitted packs. Play with multiple packs simultaneously or just one

### Pack Editor: 

A full GUI editor for adding new locations and submitting them to the main game 

### Challenge Modes: 

Enable blurring, time limits, and difficulty filters to tailor your experience



## Local Setup
To set up Hollow Guessr locally, follow these steps:

1. Clone the repository:


```bash
git clone https://github.com/logboy2000/HKGuessr.git
```
*Due to the repo containing all ~2-3GB of image packs, the clone may take a while*

2. Navigate to the project directory:
```bash
cd HKGuessr
```

3. Start a simple local server (for example, using Python):
```bash
python -m http.server 8000 --bind localhost
```
4. Access the game at [http://localhost:8000/](http://localhost:8000/).

## Credits
- **Hollow Knight**: Created by Team Cherry and source of all in game screenshots.
- **[The HK Wiki](https://hollowknight.wiki/)**: Provided 54 of the screenshots in game
- **[HK Title Generator](https://prashantmohta.github.io/TitleGenerator.HollowKnight/)**: Used to make the game's logo
- **[GeoGuessr](https://www.geoguessr.com/)**: Inspired by the mechanics of GeoGuessr.
- **Community Contributors**: Special thanks to everyone who has contributed image packs and locations! See the full list of contributors on the [credits page](https://hollowguessr.pages.dev/credits.html).

## Support Me
I don't want your money. Donate to charity or something.
