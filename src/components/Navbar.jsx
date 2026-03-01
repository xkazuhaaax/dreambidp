import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useShortlist } from '../contexts/ShortlistContext';
import ProfileDropdown from './ProfileDropdown';

function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, isAuthenticated, logout } = useAuth();
  const { getShortlistedCount } = useShortlist();
  const navigate = useNavigate();

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  const closeMenu = () => {
    setIsOpen(false);
  };

  const toggleMobileMenu = () => {
    setMenuOpen(!menuOpen);
  };

  const handleLogout = () => {
    logout();
    setMenuOpen(false);
    navigate('/login');
  };

  return (
    <nav className="bg-gradient-to-b from-midnight-950 to-midnight-900 backdrop-blur-md shadow-dark-elevation sticky top-0 z-50 border-b border-midnight-700">
      <div className="max-w-7xl mx-auto px-4 md:px-16">
        <div className="flex justify-between items-center py-4 md:py-8">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-red-600 to-red-700 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-lg">D</span>
            </div>
            <Link 
              to="/" 
              onClick={closeMenu}
              className="text-xl md:text-2xl font-semibold text-white hover:text-gold transition-all duration-300"
            >
              Dream<span className="text-red-500">Bid</span>
            </Link>
          </div>

          {/* Desktop Navigation - Menu Dropdown */}
          <div className="hidden md:flex items-center gap-8">
            <div className="relative group">
              <button className="text-text-nav hover:text-gold transition-all duration-300 font-medium text-sm flex items-center gap-2">
                Menu
                <svg className="w-4 h-4 group-hover:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </button>
              <div className="absolute left-0 mt-0 w-48 bg-midnight-800 border border-midnight-700 rounded-lg shadow-dark-elevation opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300">
                <Link to="/properties" className="block px-4 py-3 text-text-nav hover:text-gold hover:bg-midnight-700 transition-colors first:rounded-t-lg">
                  Properties
                </Link>
                <Link to="/register" className="block px-4 py-3 text-text-nav hover:text-gold hover:bg-midnight-700 transition-colors">
                  Get Started
                </Link>
                <a href="#buying-process" className="block px-4 py-3 text-text-nav hover:text-gold hover:bg-midnight-700 transition-colors">
                  How it Works
                </a>
                <Link to="/contact" className="block px-4 py-3 text-text-nav hover:text-gold hover:bg-midnight-700 transition-colors">
                  Contact Us
                </Link>
                <Link to="/" className="block px-4 py-3 text-text-nav hover:text-gold hover:bg-midnight-700 transition-colors last:rounded-b-lg">
                  Home
                </Link>
              </div>
            </div>
            
            {isAuthenticated && user ? (
              <div className="flex items-center gap-4">
                <Link 
                  to="/shortlisted"
                  className="relative text-text-nav hover:text-gold transition-colors p-2 rounded-lg hover:bg-midnight-800"
                  title="Shortlisted Properties"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                  {getShortlistedCount() > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                      {getShortlistedCount()}
                    </span>
                  )}
                </Link>
                <ProfileDropdown user={user} />
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link 
                  to="/shortlisted"
                  className="relative text-text-nav hover:text-gold transition-colors p-2 rounded-lg hover:bg-midnight-800"
                  title="Shortlisted Properties"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                  {getShortlistedCount() > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                      {getShortlistedCount()}
                    </span>
                  )}
                </Link>
                <Link to="/login" className="inline-flex items-center gap-2 bg-gold text-midnight-950 px-6 md:px-10 py-3 md:py-4 rounded-btn hover:bg-gold-hover transition-all duration-300 font-semibold text-xs md:text-sm">
                  Sign In
                </Link>
                <Link to="/signup" className="inline-flex items-center gap-2 bg-gold text-midnight-950 px-6 md:px-10 py-3 md:py-4 rounded-btn hover:bg-gold-hover transition-all duration-300 font-semibold text-xs md:text-sm">
                  Sign Up
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Hamburger Button & Icons */}
          <div className="md:hidden flex items-center gap-2">
            {/* Mobile Shortlist Icon */}
            <Link 
              to="/shortlisted"
              className="relative text-text-nav hover:text-gold transition-colors p-2 rounded-lg hover:bg-midnight-800"
              title="Shortlisted Properties"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              {getShortlistedCount() > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center text-xs">
                  {getShortlistedCount()}
                </span>
              )}
            </Link>

            {/* Hamburger Button */}
            <button
              onClick={toggleMobileMenu}
              className="inline-flex items-center justify-center p-2 rounded-md text-text-nav hover:text-gold hover:bg-midnight-800 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-gold transition-colors"
              aria-expanded="false"
            >
              <span className="sr-only">Open main menu</span>
              {menuOpen ? (
                <svg className="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {menuOpen && (
          <div className="md:hidden border-t border-midnight-700 pb-4">
            <div className="space-y-3">
              <Link
                to="/properties"
                onClick={() => setMenuOpen(false)}
                className="text-text-nav hover:text-gold hover:bg-midnight-800 block px-4 py-3 rounded-btn text-base font-medium transition-colors"
              >
                Properties
              </Link>
              <Link
                to="/register"
                onClick={() => setMenuOpen(false)}
                className="text-text-nav hover:text-gold hover:bg-midnight-800 block px-4 py-3 rounded-btn text-base font-medium transition-colors"
              >
                Get Started
              </Link>
              <a
                href="#buying-process"
                onClick={() => setMenuOpen(false)}
                className="text-text-nav hover:text-gold hover:bg-midnight-800 block px-4 py-3 rounded-btn text-base font-medium transition-colors"
              >
                How it Works
              </a>
              <Link
                to="/contact"
                onClick={() => setMenuOpen(false)}
                className="text-text-nav hover:text-gold hover:bg-midnight-800 block px-4 py-3 rounded-btn text-base font-medium transition-colors"
              >
                Contact-Us
              </Link>
              {isAuthenticated && user ? (
                <>
                  <Link
                    to={user?.role === 'admin' || user?.role === 'staff' ? '/admin/dashboard' : '/dashboard'}
                    onClick={() => setMenuOpen(false)}
                    className="text-text-nav hover:text-gold hover:bg-midnight-800 block px-4 py-3 rounded-btn text-base font-medium transition-colors"
                  >
                    Dashboard
                  </Link>
                  {(user?.role !== 'admin' && user?.role !== 'staff') && (
                    <>
                      <Link
                        to="/profile"
                        onClick={() => setMenuOpen(false)}
                        className="text-text-nav hover:text-gold hover:bg-midnight-800 block px-4 py-3 rounded-btn text-base font-medium transition-colors"
                      >
                        Profile
                      </Link>
                      <Link
                        to="/settings"
                        onClick={() => setMenuOpen(false)}
                        className="text-text-nav hover:text-gold hover:bg-midnight-800 block px-4 py-3 rounded-btn text-base font-medium transition-colors"
                      >
                        Settings
                      </Link>
                    </>
                  )}
                  <button
                    onClick={handleLogout}
                    className="text-red-400 hover:text-red-300 hover:bg-midnight-800 w-full text-left block px-4 py-3 rounded-btn text-base font-medium transition-colors"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    onClick={() => setMenuOpen(false)}
                    className="inline-flex items-center gap-2 bg-gold text-midnight-950 px-4 py-3 rounded-btn text-base font-semibold hover:bg-gold-hover transition-all duration-300 w-full justify-center"
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/signup"
                    onClick={() => setMenuOpen(false)}
                    className="inline-flex items-center gap-2 bg-gold text-midnight-950 px-4 py-3 rounded-btn text-base font-semibold hover:bg-gold-hover transition-all duration-300 w-full justify-center"
                  >
                    Sign Up
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

export default Navbar;
