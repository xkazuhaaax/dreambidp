import { createContext, useState, useContext, useEffect, useMemo } from 'react';

const ShortlistContext = createContext();

export function ShortlistProvider({ children }) {
  const [shortlistedProperties, setShortlistedProperties] = useState(() => {
    // Load from localStorage on initialization
    try {
      const saved = localStorage.getItem('dreambid_shortlist');
      if (!saved) return [];
      
      const parsed = JSON.parse(saved);
      const now = new Date().getTime();
      
      // Filter out expired auctions
      const filtered = parsed.filter(item => {
        if (!item.auction_date) return true; // Keep if no expiry date
        const auctionDate = new Date(item.auction_date).getTime();
        return auctionDate > now;
      });
      
      // Update localStorage if any items were removed
      if (filtered.length !== parsed.length) {
        localStorage.setItem('dreambid_shortlist', JSON.stringify(filtered));
      }
      
      return filtered;
    } catch {
      return [];
    }
  });

  // Save to localStorage whenever shortlist changes
  useEffect(() => {
    localStorage.setItem('dreambid_shortlist', JSON.stringify(shortlistedProperties));
  }, [shortlistedProperties]);

  // Get active shortlisted properties (non-expired)
  const activeShortlistedProperties = useMemo(() => {
    const now = new Date().getTime();
    return shortlistedProperties.filter(item => {
      if (!item.auction_date) return true;
      const auctionDate = new Date(item.auction_date).getTime();
      return auctionDate > now;
    });
  }, [shortlistedProperties]);

  const toggleShortlist = (property) => {
    setShortlistedProperties(prev => {
      const exists = prev.find(p => p.id === property.id);
      if (exists) {
        return prev.filter(p => p.id !== property.id);
      } else {
        // Store property data along with auction_date for expiry checking
        return [...prev, {
          id: property.id,
          title: property.title || 'Property',
          cover_image_url: property.cover_image_url,
          reserve_price: property.reserve_price,
          city: property.city || 'Location TBD',
          state: property.state,
          bedrooms: property.bedrooms,
          area: property.area,
          property_type: property.property_type,
          auction_date: property.auction_date,
          status: property.status,
          estimated_market_value: property.estimated_market_value,
          latitude: property.latitude,
          longitude: property.longitude,
        }];
      }
    });
  };

  const isShortlisted = (propertyId) => {
    return shortlistedProperties.some(p => p.id === propertyId);
  };

  const getShortlistedCount = () => {
    return activeShortlistedProperties.length;
  };

  const clearShortlist = () => {
    setShortlistedProperties([]);
  };

  const removeExpiredListings = () => {
    const now = new Date().getTime();
    setShortlistedProperties(prev => 
      prev.filter(item => {
        if (!item.auction_date) return true;
        const auctionDate = new Date(item.auction_date).getTime();
        return auctionDate > now;
      })
    );
  };

  return (
    <ShortlistContext.Provider value={{
      shortlistedProperties: activeShortlistedProperties,
      toggleShortlist,
      isShortlisted,
      getShortlistedCount,
      clearShortlist,
      removeExpiredListings,
    }}>
      {children}
    </ShortlistContext.Provider>
  );
}

export function useShortlist() {
  const context = useContext(ShortlistContext);
  if (!context) {
    throw new Error('useShortlist must be used within ShortlistProvider');
  }
  return context;
}
