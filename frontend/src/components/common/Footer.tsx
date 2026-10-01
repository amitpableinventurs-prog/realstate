import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Facebook, Twitter, Instagram, Linkedin, Youtube, MapPin, Phone, Mail } from 'lucide-react';

const Footer: React.FC = () => {
  const [email, setEmail] = useState('');

  const handleNewsletterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Newsletter signup:', email);
    // TODO: Submit to backend
    setEmail('');
  };

  return (
    <footer className="bg-[#111827] text-white">
      <div className="max-w-[1280px] mx-auto px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
          {/* Brand Column */}
          <div>
            <Link to="/" className="flex items-center gap-3 mb-6">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-white p-1"><img src="/logo.png" alt="Bhumi Bazar" loading="lazy" decoding="async" width="40" height="40" className="h-full w-full object-contain" /></span>
              <span className="font-fraunces text-2xl font-bold">Bhumi Bazar</span>
            </Link>
            <p className="font-manrope font-extralight text-[#9ca3af] text-sm leading-relaxed mb-6">
              AI-powered luxury real estate platform connecting you with your dream home through intelligent matching and personalized recommendations.
            </p>
            {/* Social Links */}
            <div className="flex gap-3">
              <a 
                href="https://facebook.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-10 h-10 bg-[rgba(255,255,255,0.05)] hover:bg-[#A3078F] border border-[rgba(255,255,255,0.1)] rounded-lg flex items-center justify-center transition-all group"
              >
                <Facebook className="w-5 h-5 text-[#9ca3af] group-hover:text-white transition-[color]" />
              </a>
              <a 
                href="https://twitter.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-10 h-10 bg-[rgba(255,255,255,0.05)] hover:bg-[#A3078F] border border-[rgba(255,255,255,0.1)] rounded-lg flex items-center justify-center transition-all group"
              >
                <Twitter className="w-5 h-5 text-[#9ca3af] group-hover:text-white transition-[color]" />
              </a>
              <a 
                href="https://instagram.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-10 h-10 bg-[rgba(255,255,255,0.05)] hover:bg-[#A3078F] border border-[rgba(255,255,255,0.1)] rounded-lg flex items-center justify-center transition-all group"
              >
                <Instagram className="w-5 h-5 text-[#9ca3af] group-hover:text-white transition-[color]" />
              </a>
              <a 
                href="https://linkedin.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-10 h-10 bg-[rgba(255,255,255,0.05)] hover:bg-[#A3078F] border border-[rgba(255,255,255,0.1)] rounded-lg flex items-center justify-center transition-all group"
              >
                <Linkedin className="w-5 h-5 text-[#9ca3af] group-hover:text-white transition-[color]" />
              </a>
              <a 
                href="https://youtube.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-10 h-10 bg-[rgba(255,255,255,0.05)] hover:bg-[#A3078F] border border-[rgba(255,255,255,0.1)] rounded-lg flex items-center justify-center transition-all group"
              >
                <Youtube className="w-5 h-5 text-[#9ca3af] group-hover:text-white transition-[color]" />
              </a>
            </div>
          </div>

          {/* Quick Links Column */}
          <div>
            <h4 className="font-syne font-bold text-white text-lg mb-6">Quick Links</h4>
            <ul className="space-y-3">
              <li>
                <Link to="/properties" className="font-manrope font-extralight text-[#9ca3af] text-sm hover:text-white hover:pl-2 transition-all inline-block">
                  Browse Properties
                </Link>
              </li>
              <li>
                <Link to="/search" className="font-manrope font-extralight text-[#9ca3af] text-sm hover:text-white hover:pl-2 transition-all inline-block">
                  Search Properties
                </Link>
              </li>
              <li>
                <Link to="/about" className="font-manrope font-extralight text-[#9ca3af] text-sm hover:text-white hover:pl-2 transition-all inline-block">
                  About Us
                </Link>
              </li>
              <li>
                <Link to="/contact" className="font-manrope font-extralight text-[#9ca3af] text-sm hover:text-white hover:pl-2 transition-all inline-block">
                  Contact
                </Link>
              </li>
              <li>
                <Link to="/careers" className="font-manrope font-extralight text-[#9ca3af] text-sm hover:text-white hover:pl-2 transition-all inline-block">
                  Careers
                </Link>
              </li>
              <li>
                <Link to="/blog" className="font-manrope font-extralight text-[#9ca3af] text-sm hover:text-white hover:pl-2 transition-all inline-block">
                  Blog
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Info Column */}
          <div>
            <h4 className="font-syne font-bold text-white text-lg mb-6">Contact Info</h4>
            <ul className="space-y-4">
              <li>
                <a href="https://maps.google.com" target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 font-manrope font-extralight text-[#9ca3af] text-sm hover:text-white transition-[color] group">
                  <MapPin className="w-5 h-5 mt-0.5 flex-shrink-0 text-[#A3078F]" />
                  <span className="leading-relaxed">
                    502, Devpath Building,<br />
                    Near Torrent Lab,<br />
                    Ashram Road, Ahmedabad
                  </span>
                </a>
              </li>
              <li>
                <a href="tel:+919876543210" className="flex items-center gap-3 font-manrope font-extralight text-[#9ca3af] text-sm hover:text-white transition-[color]">
                  <Phone className="w-5 h-5 flex-shrink-0 text-[#A3078F]" />
                  <span>+91 98765 43210</span>
                </a>
              </li>
              <li>
                <a href="mailto:hello@buildestate.com" className="flex items-center gap-3 font-manrope font-extralight text-[#9ca3af] text-sm hover:text-white transition-[color]">
                  <Mail className="w-5 h-5 flex-shrink-0 text-[#A3078F]" />
                  <span>hello@buildestate.com</span>
                </a>
              </li>
            </ul>
          </div>

          {/* Newsletter Column */}
          <div>
            <h4 className="font-syne font-bold text-white text-lg mb-6">Stay Updated</h4>
            <p className="font-manrope font-extralight text-[#9ca3af] text-sm mb-4 leading-relaxed">
              Subscribe to our newsletter for the latest listings, market insights, and exclusive offers.
            </p>
            <form onSubmit={handleNewsletterSubmit} className="space-y-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Your email address"
                className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg px-4 py-3 font-manrope font-extralight text-sm text-white placeholder:text-[#6b7280] focus:outline-none focus:border-[#A3078F] transition-[border-color]"
                required
              />
              <button 
                type="submit"
                className="w-full bg-[#A3078F] hover:bg-[#7A0A74] text-white font-manrope font-bold text-sm px-4 py-3 rounded-lg transition-all shadow-lg hover:shadow-xl"
              >
                Subscribe
              </button>
            </form>
            <p className="font-manrope font-extralight text-[#6b7280] text-xs mt-3">
              We respect your privacy. Unsubscribe anytime.
            </p>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-[rgba(255,255,255,0.1)] pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="font-manrope font-extralight text-[#6b7280] text-sm text-center md:text-left">
              © 2026 Bhumi Bazar. All rights reserved. Powered by AI.
            </p>
            <div className="flex flex-wrap justify-center gap-6">
              <Link to="/privacy" className="font-manrope font-extralight text-[#6b7280] text-sm hover:text-white transition-[color]">
                Privacy Policy
              </Link>
              <Link to="/terms" className="font-manrope font-extralight text-[#6b7280] text-sm hover:text-white transition-[color]">
                Terms of Service
              </Link>
              <Link to="/privacy#cookies" className="font-manrope font-extralight text-[#6b7280] text-sm hover:text-white transition-[color]">
                Cookie Policy
              </Link>
              <a href="#" className="font-manrope font-extralight text-[#6b7280] text-sm hover:text-white transition-[color]">
                Sitemap
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;