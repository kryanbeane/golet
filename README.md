# Next.js Production Boilerplate

This repository is an adapted version of https://github.com/vercel/nextjs-subscription-payments 

## Demo

- https://nextjs.devtodollars.com/

## Getting Started

1. [Install node](https://nodejs.org/en/download)
2. In your terminal, run the following commands:

```bash
git clone https://github.com/devtodollars/startup-boilerplate.git YOUR_APP_NAME
cd YOUR_APP_NAME
```
3. Use `.env` file from DevToDollars
```
cd nextjs
cp .env.example .env
```
4. Run the local development server
```
npm install
npm run dev
```

## Stack

- Next.JS (App Router)
- Typescript
- Tailwind


## TODO as Issues not configured yet...

#### Currently working on  Account page, viewing active, non active, saved, applied for listings + QUEUES

### Bugs

* Privacy Policy and terms of conditions


chat notifications and unread bold chat tab

Chat small screens, 

Mobile view fixes across all app

TEST FILTERS AND SEARCH THOROUGHLY


MOBILE ISSUES 
Clicking on map with no property selected error Mobile Issue
mobile going to view property from management dashboard



### MVP Features


TODO

- Notifications Testing
- Chat read/unread fix chat top tab



Consider adding a scheduled cron (e.g., Vercel Cron or Supabase cron) to hit /api/listings/check-expired daily so it doesn’t rely on dashboard traffic.

#### TODO





