'use client';
import { LogoIcon } from './Icons';
import { Instagram } from 'lucide-react';

export const Footer = () => {
  return (
    <footer id="footer">
      <hr className="w-11/12 mx-auto" />

      <section className="container py-20 grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-x-12 gap-y-8">
        <div className="col-span-full xl:col-span-2">
          <a
            rel="noreferrer noopener"
            href="/"
            className="font-bold text-xl flex"
          >
            <LogoIcon />
            GoLet.ie
          </a>
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="font-bold text-lg">Follow Us</h3>
          <div className="flex gap-3">
            <a
              rel="noreferrer noopener"
              href="https://instagram.com" // Update with actual Instagram URL
              target="_blank"
              className="opacity-60 hover:opacity-100 flex items-center gap-2"
            >
              <Instagram className="h-5 w-5" />
              <span className="text-sm">Instagram</span>
            </a>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="font-bold text-lg">Coming Soon</h3>
          <div>
            <span className="opacity-60 text-sm">
              Web Platform
            </span>
          </div>

          <div>
            <span className="opacity-60 text-sm">
              Mobile App (iOS)
            </span>
          </div>

          <div>
            <span className="opacity-60 text-sm">
              Mobile App (Android)
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="font-bold text-lg">Quick Links</h3>
          <div>
            <a
              rel="noreferrer noopener"
              href="/#features"
              className="opacity-60 hover:opacity-100"
            >
              Features
            </a>
          </div>

          <div>
            <a
              rel="noreferrer noopener"
              href="/#pricing"
              className="opacity-60 hover:opacity-100"
            >
              Pricing
            </a>
          </div>

          <div>
            <a
              rel="noreferrer noopener"
              href="/#faq"
              className="opacity-60 hover:opacity-100"
            >
              FAQ
            </a>
          </div>
        </div>

        {/* <div className="flex flex-col gap-2">
          <h3 className="font-bold text-lg">Community</h3>
          <div>
            <a
              rel="noreferrer noopener"
              href="#"
              className="opacity-60 hover:opacity-100"
            >
              Youtube
            </a>
          </div>

          <div>
            <a
              rel="noreferrer noopener"
              href="#"
              className="opacity-60 hover:opacity-100"
            >
              Discord
            </a>
          </div>

          <div>
            <a
              rel="noreferrer noopener"
              href="#"
              className="opacity-60 hover:opacity-100"
            >
              Twitch
            </a>
          </div>
        </div> */}
      </section>

      <section className="container pb-14 text-center">
        <h3>
          &copy; 2024 {' '}
          <span className="text-primary">
            GoLet.ie
          </span>
        </h3>
      </section>
    </footer>
  );
};
