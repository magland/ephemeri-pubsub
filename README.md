# ephemeri-pubsub

## Hosting the server

This server is designed to run on Heroku.

**Step 1: Create a new Heroku app**

Sign up for a [Heroku](https://heroku.com) account and Create a new app. Name it something like `ephemeri-pubsub-1`.

**Step 2: Set system public/private keys**

In the Heroku web console, open the Settings for your project and add the API_KEY config variable to a random string of your choosing. Make a note of the random string.

**Step 3: Clone and set up this repo**

Follow the instructions in the Heroku web console to install the [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli) and log in to Heroku from your computer. Then clone and set up this repo.

```bash
heroku login

git clone <this-repo>
cd ephemeri-pubsub

# replace with the name of your project
heroku git:remote -a ephemeri-pubsub-1
```

To deploy the server:

```bash
git push heroku main
```

Make a note of the URL where the server is being hosted. For example it might be `https://ephemeri-pubsub-1.herokuapp.com`.