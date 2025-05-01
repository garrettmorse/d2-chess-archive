# Destiny 2 Chess ARG Archive

This repo archives a set of scripts that allow you to reproduce the solution to the Destiny 2 "Endgame" ARG puzzle that took place during "Episode: Heresy".

## Required Tools

* NodeJS v20+
* Python 3.12 and/or Anaconda

## Getting Started

There are both JS and Python projects located in `js` and `py`, respectively, that contain necessary scripts to reproduce the "Endgame" solution.

### The Data

First, visit [TJ09](https://github.com/TJ09)'s site, where the majority of the community data was collated. The latest data used to solve the ARG is located [here](https://tjl.co/queens-gambit-arg/data-best.json). If that URL is no longer serving the JSON file, I've also included a snapshot in the `common` folder, which we'll be using to validate the data.

With your `data-best.json` in hand, start setting up the JS project.

```sh
$ cd js
$ npm install
```

That will install `node-fetch` and `https-proxy-agent`, which are some super helpful tools for hitting Bungie's ARG API (https://qu4n7um-7ime-7unne7-4aa2.bungie.workers.dev/) that powers the [Aion site](https://aion-archives.net/).

A careful review of the `scrape.js` script will indicate that we're using HTTPS proxies to scrape the ARG API, as Bungie implemented aggressive rate limiting, likely both as an anti-abuse mechanism to handle spiky traffic, and as a clever way to slow us down.

You're more than welcome to adjust the API scrape script to your needs, but note that it may take a while to run end to end.

In order to run the script as-is, you'll need to configure `proxies.json` with a list of the proxy hosts (<IP address>:<port> or something like that), as well as create a `.env` file that contains the username and password needed to route the traffic through your proxy. In simple terms, you need to provide enough information to create this URL `http://${process.env.user}:${process.env.password}@${proxy}`. See `getAgent()` in `scrape.js` for details.

With your `.env` file and `proxies.json` configured, you can start running the script.

```sh
$ node scrape.js
```

You'll see the data from `data-best.json` begin to be ingested, and their API responses coming back. The script regularly writes responses to `api.json`, so you can monitor that if you'd like.

Once the script is finished, you can validate that all of your input data (`data-best.json`) is accurate by checking `api.json` for instances of `ERROR`.

### The Matching

Now that we've validated our input data, let's run a matching algorithm to assemble neighbors into the 64x64 grid.

For this step, we're going to use the Python project.

```sh
$ cd py
$ pip install -e .
```

Once your Python dependencies install, simply run the match script in the `src` folder. 

Thanks to [Ryheff24](https://github.com/Ryheff24/Destiny-2-Community-map-solver) for providing the bulk of `match.py`! Well done.

```sh
$ python src/match.py
```

This will use `data-best.json` to programmatically find neighbors, and then outputs the results to `tile_id_grid.json`. The format of this file is highly specific to TJ's tool for visualizing the 64x64 grid, found [here](https://tjl.co/queens-gambit-arg/self-service-matches.php). In case the page is no longer available, you can find a screenshot of the result in `common`. I also scraped TJ's site for all of the pieces, which you can find inside of `common/pieces`.

Happy reproducing!

Open an issue if you have a question, or reach me directly on discord @garrettmorse