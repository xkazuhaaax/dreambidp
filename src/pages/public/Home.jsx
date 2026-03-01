import { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { propertiesAPI } from '../../services/api';
import { shareProperty } from '../../utils/whatsapp';
import { getImageUrl } from '../../utils/imageUrl';
import { useShortlist } from '../../contexts/ShortlistContext';
import PropertyTypeDropdown from '../../components/PropertyTypeDropdown';

// Custom hook for debouncing
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

function Home() {
  const { toggleShortlist, isShortlisted } = useShortlist();
  const scrollContainerRef = useRef(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const totalSlides = 8; // We have 8 steps
  const morePropertiesRef = useRef(null);
  const citiesCarouselRef = useRef(null);
  const [carouselScroll, setCarouselScroll] = useState(0);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
  
  // Budget range mapping
  const budgetRanges = {
    '': { min: '', max: '' },
    '2000000': { min: 0, max: 2000000 },
    '4000000': { min: 2000000, max: 4000000 },
    '6000000': { min: 4000000, max: 6000000 },
    '10000000': { min: 6000000, max: 10000000 },
    '20000000': { min: 10000000, max: 20000000 },
    '50000000': { min: 20000000, max: 50000000 },
    '999999999': { min: 50000000, max: 999999999 },
  };
  
  const [filters, setFilters] = useState({
    city: '',
    property_type: [],
    budget: '',
  });

  // Handle carousel scroll
  const scrollCarousel = (direction) => {
    if (morePropertiesRef.current) {
      const scrollAmount = 400; // Scroll distance in pixels
      const currentScroll = morePropertiesRef.current.scrollLeft;
      const targetScroll = direction === 'left' 
        ? currentScroll - scrollAmount 
        : currentScroll + scrollAmount;
      
      morePropertiesRef.current.scrollTo({
        left: targetScroll,
        behavior: 'smooth'
      });
    }
  };

  // Hero text
  const heroText = 'Invest in Curated Luxury Real Estate Through Transparent Bidding';

  // Debounce text inputs (city) to avoid API calls on every keystroke
  const debouncedCity = useDebounce(filters.city, 500);

  // Create query filters object with debounced values
  const queryFilters = useMemo(() => {
    const budgetRange = budgetRanges[filters.budget] || budgetRanges[''];
    return {
      city: debouncedCity,
      property_type: filters.property_type && filters.property_type.length > 0 
        ? filters.property_type.join(',') 
        : '',
      min_price: budgetRange.min !== '' ? budgetRange.min : '',
      max_price: budgetRange.max !== '' ? budgetRange.max : '',
    };
  }, [debouncedCity, filters.property_type, filters.budget]);

  const { data: featuredData } = useQuery(
    ['featured-properties', queryFilters],
    () => {
      // Remove empty string values for numeric fields to avoid validation errors
      const params = { limit: 6 };
      if (queryFilters.city) params.city = queryFilters.city;
      if (queryFilters.property_type) params.property_type = queryFilters.property_type;
      // Only include numeric fields if they have actual values
      if (queryFilters.min_price !== '') {
        params.min_price = queryFilters.min_price;
      }
      if (queryFilters.max_price !== '') {
        params.max_price = queryFilters.max_price;
      }
      return propertiesAPI.getAll(params);
    }
  );

  // Fallback query for general properties when featured is empty
  const { data: fallbackData } = useQuery(
    ['fallback-properties'],
    () => {
      return propertiesAPI.getAll({ limit: 6 });
    }
  );

  const properties = featuredData?.data?.properties && featuredData.data.properties.length > 0 
    ? featuredData.data.properties 
    : fallbackData?.data?.properties || [];

  // Define cities data
  const citiesData = [
    { name: 'Delhi', city: 'Delhi', image: '/NewDelhi.webp' },
    { name: 'Haryana', city: 'Haryana', image: '/harayana.jpeg' },
    { name: 'Noida', city: 'Noida', image: '/noida.jpeg' },
    { name: 'Gurugram', city: 'Gurugram', image: '/gurugram.jpeg' },
    { name: 'Ludhiana', city: 'Ludhiana', image: '/Ludhiana.webp' },
    { name: 'Chandigarh', city: 'Chandigarh', image: '/chandighar.jpeg' },
    { name: 'Himachal Pradesh', city: 'Himachal Pradesh', image: '/himachal.jpeg' },
    { name: 'Rajasthan', city: 'Rajasthan', image: '/rajasthan.jpeg' },
    { name: 'Amritsar', city: 'Amritsar', image: '/amritsar.jpeg' },
  ];
  // Duplicate cities array for seamless infinite loop
  const doubledCities = [...citiesData, ...citiesData];

  // Auto-scroll cities carousel
  useEffect(() => {
    if (!autoScrollEnabled) return;

    const container = citiesCarouselRef.current;
    if (!container) return;

    const interval = setInterval(() => {
      // Smooth continuous scroll
      const scrollAmount = 140; // width of card + gap (adjusted for circular icons)
      const currentScroll = container.scrollLeft;
      const maxScroll = container.scrollWidth - container.clientWidth;
      
      if (currentScroll >= maxScroll - 10) {
        // Reset to beginning for seamless loop
        container.scrollLeft = 0;
      } else {
        container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      }
    }, 3500); // Scroll every 3.5 seconds

    return () => clearInterval(interval);
  }, [autoScrollEnabled]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  // Handle carousel navigation
  const handlePrevSlide = () => {
    const newSlide = currentSlide === 0 ? totalSlides - 1 : currentSlide - 1;
    setCurrentSlide(newSlide);
    
    if (scrollContainerRef?.current) {
      // Calculate card width based on screen size
      let cardWidth;
      const containerWidth = scrollContainerRef.current.offsetWidth;
      
      if (window.innerWidth < 768) {
        // Mobile: card should be full container width
        cardWidth = containerWidth;
      } else {
        // Desktop: fixed card widths
        cardWidth = 320; // md:w-80
      }
      
      scrollContainerRef.current.scrollBy({ 
        left: -(cardWidth + 24), // 24px is the gap
        behavior: 'smooth' 
      });
    }
  };

  const handleNextSlide = () => {
    const newSlide = currentSlide === totalSlides - 1 ? 0 : currentSlide + 1;
    setCurrentSlide(newSlide);
    
    if (scrollContainerRef?.current) {
      // Calculate card width based on screen size
      let cardWidth;
      const containerWidth = scrollContainerRef.current.offsetWidth;
      
      if (window.innerWidth < 768) {
        // Mobile: card should be full container width
        cardWidth = containerWidth;
      } else {
        // Desktop: fixed card widths
        cardWidth = 320; // md:w-80
      }
      
      scrollContainerRef.current.scrollBy({ 
        left: cardWidth + 24, // 24px is the gap
        behavior: 'smooth' 
      });
    }
  };

  return (
    <div>
      {/* Hero Section with Overlaid Search Bar */}
      <div className="relative bg-gradient-to-b from-midnight-950 to-midnight-900 text-white pt-16 md:pt-24 pb-20 md:pb-32 overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }}></div>
        <div className="relative max-w-6xl mx-auto px-4 md:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 items-center">
            {/* Left Content */}
            <div>
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-serif font-bold mb-6 leading-tight text-white max-w-md">
                Buy, Bank-Auctioned Properties
              </h1>
              <div className="space-y-4 mb-8">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 mt-1">
                    <svg className="w-6 h-6 text-gold" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <p className="text-sm md:text-base text-text-secondary">
                    Significant Discounts on Market Value
                  </p>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 mt-1">
                    <svg className="w-6 h-6 text-gold" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <p className="text-sm md:text-base text-text-secondary">
                    100% Clear & Verifiable Properties
                  </p>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 mt-1">
                    <svg className="w-6 h-6 text-gold" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <p className="text-sm md:text-base text-text-secondary">
                    Hassle-Free Loan Options
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center w-full sm:w-auto">
                <Link
                  to="/register"
                  className="btn-primary inline-flex items-center justify-center gap-2 text-center whitespace-nowrap w-full sm:w-auto"
                >
                  Register Your Requirements
                </Link>
                <Link
                  to="/properties"
                  className="btn-secondary inline-flex items-center justify-center gap-2 text-center whitespace-nowrap w-full sm:w-auto"
                >
                  View Properties
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
              </div>
            </div>
            
            {/* Right Visual - House Image */}
            <div className="hidden lg:block">
              <div className="relative h-96 rounded-2xl overflow-hidden">
                <img 
                  src="/banner.png" 
                  alt="Luxury Property" 
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar Section */}
      <div className="relative -mt-12 sm:-mt-16 md:-mt-20 px-4 sm:px-6 md:px-8 pb-0 z-10">
        <div className="max-w-6xl mx-auto">
          <div className="bg-midnight-800 rounded-2xl shadow-2xl border border-midnight-700" style={{overflow: 'visible'}}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-0 p-0 overflow-visible">
              {/* Search Locality Input */}
              <div className="border-b md:border-b-0 md:border-r border-midnight-700 p-6">
                <label className="block text-xs font-semibold text-text-soft uppercase tracking-wide mb-3">Search Locality, City or State</label>
                <input
                  type="text"
                  value={filters.city}
                  onChange={(e) => handleFilterChange('city', e.target.value)}
                  placeholder="e.g. Delhi, Noida, Gurugram"
                  className="w-full px-4 py-3 bg-midnight-800 border-b-2 border-midnight-700 text-text-primary placeholder-text-muted text-sm focus:outline-none focus:border-gold transition"
                />
              </div>

              {/* Budget Dropdown */}
              <div className="border-b md:border-b-0 md:border-r border-midnight-700 p-6">
                <label className="block text-xs font-semibold text-text-soft uppercase tracking-wide mb-3">Budget</label>
                <select
                  value={filters.budget}
                  onChange={(e) => handleFilterChange('budget', e.target.value)}
                  className="w-full px-4 py-3 bg-midnight-800 border-b-2 border-midnight-700 text-text-primary text-sm focus:outline-none focus:border-gold transition appearance-none cursor-pointer"
                  style={{backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23CBA135' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', paddingRight: '36px'}}
                >
                  <option value="">- Select from dropdown -</option>
                  <option value="2000000">Under 20L</option>
                  <option value="4000000">20-40L</option>
                  <option value="6000000">40-60L</option>
                  <option value="10000000">60L-1Cr</option>
                  <option value="20000000">1-2Cr</option>
                  <option value="50000000">2-5Cr</option>
                  <option value="999999999">Above 5Cr</option>
                </select>
              </div>

              {/* Property Type Multi-Select */}
              <div className="border-b md:border-b-0 md:border-r border-midnight-700 p-6">
                <label className="block text-xs font-semibold text-text-soft uppercase tracking-wide mb-3">Property Type</label>
                <PropertyTypeDropdown
                  value={filters.property_type}
                  onChange={(newValue) => handleFilterChange('property_type', newValue)}
                />
              </div>

              {/* Search Button */}
              <div className="p-6 flex items-center justify-center md:justify-end">
                <Link
                  to="/properties"
                  state={{ filters: filters }}
                  className="w-full md:w-auto px-8 py-3 bg-gold text-midnight-950 rounded-lg hover:bg-gold-hover focus:outline-none focus:ring-2 focus:ring-gold transition-all font-semibold text-center shadow-md hover:shadow-lg whitespace-nowrap"
                >
                  Search
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Discover Properties in Top Cities Section */}
      <div className="bg-gradient-to-b from-midnight-950 to-midnight-900 px-4 md:px-8 py-12 md:py-16">
        <div className="max-w-6xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-12 md:mb-16">
            <p className="text-xs md:text-sm font-semibold text-gold uppercase tracking-widest mb-3">POPULAR CITIES</p>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-serif font-bold text-white mb-4">
              Discover Properties in <span className="text-gold">Top Cities</span>
            </h2>
            <p className="text-text-secondary max-w-2xl mx-auto text-sm md:text-base leading-relaxed">
              Explore a diverse range of properties in prime cities, offered by leading banks and financial institutions. Ideal for buying, investing, or flipping.
            </p>
          </div>

          {/* Cities Carousel */}
          <div 
            className="relative group"
            onMouseEnter={() => setAutoScrollEnabled(false)}
            onMouseLeave={() => setAutoScrollEnabled(true)}
          >
            {/* Left Arrow */}
            <button
              onClick={() => {
                const container = document.getElementById('citiesCarousel');
                if (container) {
                  container.scrollBy({ left: -120, behavior: 'smooth' });
                }
              }}
              className="absolute -left-4 md:-left-6 top-1/2 -translate-y-1/2 z-20 bg-gold text-midnight-950 rounded-full p-2 md:p-3 hover:bg-gold-hover transition-all shadow-lg hover:shadow-xl opacity-0 group-hover:opacity-100 transition-opacity"
              title="Scroll left"
            >
              <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            {/* Right Arrow */}
            <button
              onClick={() => {
                const container = document.getElementById('citiesCarousel');
                if (container) {
                  container.scrollBy({ left: 120, behavior: 'smooth' });
                }
              }}
              className="absolute -right-4 md:-right-6 top-1/2 -translate-y-1/2 z-20 bg-gold text-midnight-950 rounded-full p-2 md:p-3 hover:bg-gold-hover transition-all shadow-lg hover:shadow-xl opacity-0 group-hover:opacity-100 transition-opacity"
              title="Scroll right"
            >
              <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            {/* Cities Container */}
            <div 
              id="citiesCarouselWrapper"
              className="relative"
            >
              <div 
                id="citiesCarousel"
                ref={citiesCarouselRef}
                className="flex gap-4 md:gap-6 overflow-x-auto scroll-smooth hide-scrollbar px-4"
              >
              {/* City Cards */}
              {doubledCities.map((city, index) => (
                <Link
                  key={index}
                  to="/properties"
                  state={{ filters: { city: city.city } }}
                  className="flex-shrink-0 flex flex-col items-center text-center group cursor-pointer"
                >
                  <div className="relative w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden mb-3 md:mb-4 shadow-lg hover:shadow-2xl transition-all transform group-hover:scale-110 border-2 border-gold">
                    <img
                      src={city.image}
                      alt={city.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="300"%3E%3Ccircle cx="150" cy="150" r="150" fill="%231F2A3D"/%3E%3Ctext fill="%23CBA135" x="50%25" y="50%25" text-anchor="middle" dy=".3em" font-size="40" font-weight="bold"%3E' + city.name.charAt(0) + '%3C/text%3E%3C/svg%3E';
                      }}
                    />
                  </div>
                  <h3 className="text-sm md:text-base font-bold text-white group-hover:text-gold transition-colors">{city.name}</h3>
                  <p className="text-xs text-text-secondary">{city.city}</p>
                </Link>
              ))}
              </div>
            </div>

            {/* Gradient Overlays */}
            <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-midnight-950 to-transparent z-10 pointer-events-none"></div>
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-midnight-950 to-transparent z-10 pointer-events-none"></div>
          </div>
        </div>
      </div>

      {/* Featured Properties */}
      <div className="bg-gradient-to-b from-midnight-900 to-midnight-950 px-4 md:px-8 py-8 md:py-16">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-serif font-bold text-white mb-10 md:mb-16">Featured Properties</h2>

          {properties.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-text-muted">No properties available at the moment.</p>
              <p className="text-text-secondary text-sm mt-2">Check back soon for new listings!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-10">
              {properties.map((property) => {
                const imageUrl = property.cover_image_url || 
                  (property.images && property.images.length > 0 
                    ? (typeof property.images[0] === 'object' ? property.images[0].image_url : property.images[0])
                    : null);

                return (
                <div key={property.id} className="group card overflow-hidden hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 flex flex-col h-full">
                  <div className="relative h-48 md:h-64 overflow-hidden bg-midnight-800">
                    {imageUrl ? (
                      <img
                        src={getImageUrl(imageUrl)}
                        alt={property.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition duration-300"
                        onError={(e) => {
                          e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%231F2A3D" width="400" height="300"/%3E%3Ctext fill="%23666" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3ENo Image%3C/text%3E%3C/svg%3E';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-midnight-800">
                        <span className="text-text-secondary">No Image</span>
                      </div>
                    )}
                    
                    {/* Wishlist Button */}
                    <button
                      onClick={() => {
                        toggleShortlist(property);
                        toast.success(isShortlisted(property.id) ? 'Removed from shortlist' : 'Added to shortlist');
                      }}
                      className="absolute top-4 right-4 p-2 bg-midnight-800 rounded-full hover:bg-midnight-700 transition"
                    >
                      <svg className={`w-5 h-5 ${isShortlisted(property.id) ? 'fill-red-500 text-red-500' : 'text-text-muted'}`} viewBox="0 0 24 24">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                      </svg>
                    </button>
                  </div>
                  <div className="p-4 md:p-6 flex flex-col h-full">
                    <div className="flex-grow">
                      <h3 className="text-lg md:text-xl font-bold text-white mb-2 line-clamp-2 min-h-14">
                        {property.title}
                      </h3>
                      <p className="text-text-secondary text-xs md:text-sm mb-3">
                        📍 {property.city}, {property.state} • {property.property_size || 'N/A'} sq.ft
                      </p>
                      <div className="space-y-2">
                        <div>
                          <p className="text-text-secondary text-xs font-semibold uppercase tracking-wide mb-1">Reserve Price</p>
                          <p className="text-lg md:text-2xl font-bold text-gold">₹{parseFloat(property.reserve_price).toLocaleString('en-IN')}</p>
                        </div>
                        <div className="flex justify-between text-xs pt-2 border-t border-midnight-700">
                          <div>
                            <p className="text-text-secondary">Application Date</p>
                            <p className="text-text-primary font-medium">
                              {property.auction_date 
                                ? new Date(property.auction_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                                : 'N/A'
                              }
                            </p>
                          </div>
                          <div>
                            <p className="text-text-secondary">Possession Status</p>
                            <p className="text-text-primary font-medium">{property.possession_type || 'Physical'}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 md:gap-3 mt-4 md:mt-6 pt-4 md:pt-6 border-t border-midnight-700">
                      <Link
                        to={`/properties/${property.id}`}
                        className="flex-1 btn-primary text-center text-xs md:text-sm py-3 md:py-3 whitespace-nowrap"
                      >
                        View Details
                      </Link>
                      <button
                        onClick={() => shareProperty(property)}
                        className="px-3 md:px-4 py-3 md:py-3 bg-status-live text-white rounded-btn hover:bg-green-600 transition-all"
                        title="Share on WhatsApp"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .96 4.534.96 10.08c0 1.752.413 3.4 1.141 4.865L.06 23.884l9.251-2.39a11.717 11.717 0 005.739 1.49h.005c6.554 0 11.09-5.533 11.09-11.088a11.106 11.106 0 00-3.291-7.918"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          )}

          {properties.length > 0 && (
            <div className="text-center mt-20">
              <Link
                to="/properties"
                className="btn-primary inline-flex items-center gap-2"
              >
                View All Properties
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* More Properties Section - Horizontal Carousel */}
      <div className="bg-gradient-to-b from-midnight-950 to-midnight-900 px-4 md:px-8 py-12 md:py-24">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-serif font-bold text-white mb-10 md:mb-16">More Properties</h2>

          {properties.length > 0 && (
            <div className="relative group">
              {/* Left Arrow Button */}
              <button
                onClick={() => scrollCarousel('left')}
                className="absolute -left-6 md:-left-8 top-1/2 -translate-y-1/2 z-20 bg-gold text-midnight-950 rounded-full p-3 md:p-4 hover:bg-gold-hover transition-all shadow-lg hover:shadow-xl opacity-0 group-hover:opacity-100 transition-opacity"
                title="Scroll left"
              >
                <svg className="w-6 h-6 md:w-7 md:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              {/* Carousel Container */}
              <div className="overflow-hidden rounded-lg">
                <div 
                  ref={morePropertiesRef}
                  className="flex gap-6 md:gap-8 overflow-x-auto scroll-smooth hide-scrollbar"
                >
                  {/* Duplicate properties for infinite loop effect */}
                  {[...properties, ...properties].map((property, index) => {
                    const imageUrl = property.cover_image_url || 
                      (property.images && property.images.length > 0 
                        ? (typeof property.images[0] === 'object' ? property.images[0].image_url : property.images[0])
                        : null);

                    return (
                      <div key={`${property.id}-${index}`} className="flex-shrink-0 w-80 md:w-96">
                        <div className="card overflow-hidden hover:shadow-2xl transition-all duration-300 h-full flex flex-col">
                          <div className="relative h-48 md:h-56 overflow-hidden bg-midnight-800">
                            {imageUrl ? (
                              <img
                                src={getImageUrl(imageUrl)}
                                alt={property.title}
                                className="w-full h-full object-cover hover:scale-110 transition duration-300"
                                onError={(e) => {
                                  e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%231F2A3D" width="400" height="300"/%3E%3Ctext fill="%23666" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3ENo Image%3C/text%3E%3C/svg%3E';
                                }}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-midnight-800">
                                <span className="text-text-secondary">No Image</span>
                              </div>
                            )}
                            <div className="absolute top-4 left-4">
                              <span className={`px-4 py-2 rounded-full text-xs font-bold backdrop-blur-sm ${
                                property.auction_status === 'active' ? 'bg-status-live/90 text-white' :
                                property.auction_status === 'upcoming' ? 'bg-gold/90 text-midnight-950' :
                                'bg-text-secondary/30 text-text-primary'
                              }`}>
                                {property.auction_status === 'active' ? '🔴 Bidding Live' : property.auction_status.toUpperCase()}
                              </span>
                            </div>
                            
                            {/* Wishlist Button */}
                            <button
                              onClick={() => {
                                toggleShortlist(property);
                                toast.success(isShortlisted(property.id) ? 'Removed from shortlist' : 'Added to shortlist');
                              }}
                              className="absolute top-4 right-4 p-2 bg-midnight-800 rounded-full hover:bg-midnight-700 transition"
                            >
                              <svg className={`w-5 h-5 ${isShortlisted(property.id) ? 'fill-red-500 text-red-500' : 'text-text-muted'}`} viewBox="0 0 24 24">
                                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                              </svg>
                            </button>
                          </div>
                          <div className="p-4 md:p-6 flex-grow flex flex-col">
                            <h3 className="text-lg md:text-xl font-bold text-white mb-2 line-clamp-2">{property.title}</h3>
                            <p className="text-text-secondary text-xs md:text-sm mb-3">
                              📍 {property.city}, {property.state} • {property.property_size} sq.ft
                            </p>
                            <p className="text-lg md:text-2xl font-bold text-gold mb-4 flex-grow">₹{parseFloat(property.reserve_price).toLocaleString('en-IN')}</p>
                            <div className="flex gap-2 md:gap-3 pt-4 md:pt-6 border-t border-midnight-700">
                              <Link
                                to={`/properties/${property.id}`}
                                className="flex-1 btn-primary text-center text-xs md:text-sm py-3 md:py-4"
                              >
                                View Details
                              </Link>
                              <button
                                onClick={() => shareProperty(property)}
                                className="px-3 md:px-4 py-3 md:py-4 bg-status-live text-white rounded-btn hover:bg-green-600 transition-all"
                                title="Share on WhatsApp"
                              >
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .96 4.534.96 10.08c0 1.752.413 3.4 1.141 4.865L.06 23.884l9.251-2.39a11.717 11.717 0 005.739 1.49h.005c6.554 0 11.09-5.533 11.09-11.088a11.106 11.106 0 00-3.291-7.918"/>
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Arrow Button */}
              <button
                onClick={() => scrollCarousel('right')}
                className="absolute -right-6 md:-right-8 top-1/2 -translate-y-1/2 z-20 bg-gold text-midnight-950 rounded-full p-3 md:p-4 hover:bg-gold-hover transition-all shadow-lg hover:shadow-xl opacity-0 group-hover:opacity-100 transition-opacity"
                title="Scroll right"
              >
                <svg className="w-6 h-6 md:w-7 md:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Gradient Overlays */}
              <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-midnight-950 to-transparent z-10 pointer-events-none rounded-lg"></div>
              <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-midnight-950 to-transparent z-10 pointer-events-none rounded-lg"></div>
            </div>
          )}
        </div>
      </div>

      {/* Your Buying Process Section */}
      <div id="buying-process" className="bg-gradient-to-b from-midnight-950 to-midnight-900 px-4 md:px-8 py-16 md:py-24 border-t border-midnight-700">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12 md:mb-16">
            <p className="text-sm md:text-base font-semibold text-gold mb-2">HOW IT WORKS</p>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">The <span className="text-gold">Buying Process</span></h2>
            <p className="text-text-secondary text-base md:text-lg max-w-2xl mx-auto">How to buy properties from banks? We're here to guide you through the process, making your property acquisition journey seamless and hassle-free.</p>
          </div>

          {/* Horizontal Carousel */}
          <div className="relative">
            {/* Scroll Container */}
            <div 
              ref={scrollContainerRef}
              className="flex gap-6 overflow-x-auto pb-8 scroll-smooth hide-scrollbar"
              style={{ scrollBehavior: 'smooth' }}
            >
              {/* Step 1 */}
              <div className="flex-shrink-0 w-full md:w-80 lg:w-72 bg-gradient-to-br from-midnight-800 to-midnight-750 rounded-lg p-6 border border-midnight-700">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 bg-cyan-500 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-xl font-bold text-midnight-950">01</span>
                  </div>
                  <svg className="w-6 h-6 text-cyan-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-text-primary mb-2">Choose a Property</h3>
                <p className="text-text-secondary text-sm">Explore our listings & find a property that meets your requirements.</p>
              </div>

              {/* Step 2 */}
              <div className="flex-shrink-0 w-full md:w-80 lg:w-72 bg-gradient-to-br from-midnight-800 to-midnight-750 rounded-lg p-6 border border-midnight-700">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 bg-cyan-500 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-xl font-bold text-white">02</span>
                  </div>
                  <svg className="w-6 h-6 text-cyan-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-text-primary mb-2">Pay EMD</h3>
                <p className="text-text-secondary text-sm">Pay 10% earnest money deposit as an assurance of interest in the property.</p>
              </div>

              {/* Step 3 */}
              <div className="flex-shrink-0 w-full md:w-80 lg:w-72 bg-gradient-to-br from-midnight-800 to-midnight-750 rounded-lg p-6 border border-midnight-700">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-xl font-bold text-white">03</span>
                  </div>
                  <svg className="w-6 h-6 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-text-primary mb-2">Submit Application</h3>
                <p className="text-text-secondary text-sm">Submit the Common Application Form (CAF) and prepare for auction.</p>
              </div>

              {/* Step 4 */}
              <div className="flex-shrink-0 w-full md:w-80 lg:w-72 bg-gradient-to-br from-midnight-800 to-midnight-750 rounded-lg p-6 border border-midnight-700">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-xl font-bold text-white">04</span>
                  </div>
                  <svg className="w-6 h-6 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.856-1.487M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 0a2 2 0 11-4 0 2 2 0 014 0zM5 20a6 6 0 0110-12 6 6 0 0110 12H5z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-text-primary mb-2">Participate in Auction</h3>
                <p className="text-text-secondary text-sm">Register with the auction portal and take part in the bidding process.</p>
              </div>

              {/* Step 5 */}
              <div className="flex-shrink-0 w-full md:w-80 lg:w-72 bg-gradient-to-br from-midnight-800 to-midnight-750 rounded-lg p-6 border border-midnight-700">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-xl font-bold text-white">05</span>
                  </div>
                  <svg className="w-6 h-6 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-text-primary mb-2">Auction Outcome</h3>
                <p className="text-text-secondary text-sm">If you win, pay 15%. If you lose, get the EMD refund.</p>
              </div>

              {/* Step 6 */}
              <div className="flex-shrink-0 w-full md:w-80 lg:w-72 bg-gradient-to-br from-midnight-800 to-midnight-750 rounded-lg p-6 border border-midnight-700">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 bg-yellow-500 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-xl font-bold text-midnight-950">06</span>
                  </div>
                  <svg className="w-6 h-6 text-yellow-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-text-primary mb-2">Pay 75% in 15 Days</h3>
                <p className="text-text-secondary text-sm">Pay the remaining 75% within 15 Days to start the registration process.</p>
              </div>

              {/* Step 7 */}
              <div className="flex-shrink-0 w-full md:w-80 lg:w-72 bg-gradient-to-br from-midnight-800 to-midnight-750 rounded-lg p-6 border border-midnight-700">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 bg-orange-400 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-xl font-bold text-white">07</span>
                  </div>
                  <svg className="w-6 h-6 text-orange-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-text-primary mb-2">Obtain Sale Certificate</h3>
                <p className="text-text-secondary text-sm">The seller institution issues the sale certificate after payment completion.</p>
              </div>

              {/* Step 8 */}
              <div className="flex-shrink-0 w-full md:w-80 lg:w-72 bg-gradient-to-br from-midnight-800 to-midnight-750 rounded-lg p-6 border border-midnight-700">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 bg-red-500 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-xl font-bold text-white">08</span>
                  </div>
                  <svg className="w-6 h-6 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-3m0 0l7-4 7 4M5 9v10a1 1 0 001 1h12a1 1 0 001-1V9m-9 16l4-4m0 0l4 4m-4-4V5" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-text-primary mb-2">Register the Property</h3>
                <p className="text-text-secondary text-sm">Authorized officer registers the property in the Sub-Registrar Office.</p>
              </div>

              {/* Spacer for proper scroll padding */}
              <div className="flex-shrink-0 w-8"></div>
            </div>

            {/* Navigation Arrows */}
            <div className="flex justify-center gap-4 mt-8">
              <button
                onClick={handlePrevSlide}
                className="w-12 h-12 rounded-full border-2 border-midnight-600 flex items-center justify-center hover:border-gold hover:bg-midnight-800 transition-all"
              >
                <svg className="w-6 h-6 text-midnight-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={handleNextSlide}
                className="w-12 h-12 rounded-full border-2 border-midnight-600 flex items-center justify-center hover:border-gold hover:bg-midnight-800 transition-all"
              >
                <svg className="w-6 h-6 text-midnight-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Timeline Line */}
            <div className="absolute left-0 right-0 top-0 h-1 bg-gradient-to-r from-cyan-400 via-blue-400 to-red-400 -mt-8 hidden md:block"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Home;
