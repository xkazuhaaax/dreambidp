import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useShortlist } from '../../contexts/ShortlistContext';
import { getImageUrl } from '../../utils/imageUrl';
import toast from 'react-hot-toast';

function Shortlisted() {
  const { shortlistedProperties, toggleShortlist, isShortlisted, clearShortlist } = useShortlist();

  const groupedProperties = useMemo(() => {
    const groups = {
      active: [],
      expired: [],
    };

    shortlistedProperties.forEach(property => {
      if (property.auction_date) {
        const auctionDate = new Date(property.auction_date).getTime();
        const now = new Date().getTime();
        if (auctionDate > now) {
          groups.active.push(property);
        } else {
          groups.expired.push(property);
        }
      } else {
        groups.active.push(property);
      }
    });

    return groups;
  }, [shortlistedProperties]);

  const handleRemoveFromShortlist = (property) => {
    toggleShortlist(property);
    toast.success('Removed from shortlist');
  };

  const handleClearAll = () => {
    if (window.confirm('Are you sure you want to clear all shortlisted properties?')) {
      clearShortlist();
      toast.success('All properties cleared from shortlist');
    }
  };

  const renderPropertyCard = (property) => (
    <div
      key={property.id}
      className="bg-midnight-900 border border-midnight-700 rounded-2xl overflow-hidden hover:border-midnight-600 hover:shadow-lg transition-all group"
    >
      {/* Image Container */}
      <Link
        to={`/properties/${property.id}`}
        className="relative overflow-hidden bg-midnight-800 aspect-video block"
      >
        <img
          src={getImageUrl(property.cover_image_url)}
          alt={property.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          onError={(e) => {
            e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%23333" width="400" height="300"/%3E%3Ctext fill="%23666" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3ENo Image%3C/text%3E%3C/svg%3E';
          }}
        />

        {/* Status Badge */}
        {property.status && (
          <div className="absolute top-4 left-4">
            <span
              className={`px-3 py-1 rounded-lg text-xs font-medium ${
                property.status === 'upcoming'
                  ? 'bg-blue-50/20 text-blue-300 border border-blue-400/30'
                  : property.status === 'active'
                  ? 'bg-green-50/20 text-green-300 border border-green-400/30'
                  : property.status === 'expired'
                  ? 'bg-red-50/20 text-red-300 border border-red-400/30'
                  : property.status === 'sold'
                  ? 'bg-purple-50/20 text-purple-300 border border-purple-400/30'
                  : 'bg-gray-50/20 text-gray-300 border border-gray-400/30'
              }`}
            >
              {property.status.charAt(0).toUpperCase() + property.status.slice(1)}
            </span>
          </div>
        )}

        {/* Auction Date */}
        {property.auction_date && (
          <div className="absolute top-4 right-4">
            <span className="bg-black/70 text-white text-xs font-medium px-3 py-1 rounded-lg">
              {new Date(property.auction_date).toLocaleDateString()}
            </span>
          </div>
        )}

        {/* Heart Button */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleRemoveFromShortlist(property);
          }}
          className="absolute bottom-4 right-4 p-2 bg-white/90 rounded-full hover:bg-white transition-colors shadow-lg"
          title="Remove from shortlist"
        >
          <svg className="w-5 h-5 text-red-500 fill-current" viewBox="0 0 24 24">
            <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </button>
      </Link>

      {/* Property Details */}
      <div className="p-5 flex flex-col h-full bg-midnight-900">
        <Link
          to={`/properties/${property.id}`}
          className="group/title"
        >
          <h3 className="font-semibold text-text-primary text-base line-clamp-2 group-hover/title:text-gold transition mb-3">
            {property.title || 'Property'}
          </h3>
        </Link>

        {/* Location */}
        <p className="text-sm text-text-secondary mb-4">
          {property.city || 'Location'}
          {property.state ? `, ${property.state}` : ''}
        </p>

        {/* Property Features */}
        <div className="flex items-center gap-4 text-xs mb-4 flex-wrap">
          {property.bedrooms && (
            <div className="flex items-center gap-1">
              <span className="text-text-primary font-medium">{property.bedrooms}</span>
              <span className="text-text-secondary">BHK</span>
            </div>
          )}
          {property.area && (
            <div className="flex items-center gap-1">
              <span className="text-text-primary font-medium">{Math.round(property.area)}</span>
              <span className="text-text-secondary">sq.ft.</span>
            </div>
          )}
          {property.property_type && (
            <div className="flex items-center gap-1">
              <span className="text-text-secondary">{property.property_type}</span>
            </div>
          )}
        </div>

        {/* Price */}
        <div className="mt-auto pt-3 border-t border-midnight-700">
          <p className="text-lg font-bold text-gold">
            ₹{property.reserve_price ? property.reserve_price.toLocaleString() : 'N/A'}
          </p>
          <p className="text-xs text-text-secondary mt-1">Reserve Price</p>
        </div>

        {/* View Details Button */}
        <Link
          to={`/properties/${property.id}`}
          className="mt-4 px-4 py-2 bg-gold/10 text-gold hover:bg-gold/20 rounded-lg transition text-center text-sm font-medium border border-gold/30 hover:border-gold"
        >
          View Details
        </Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-midnight-950">
      {/* Header */}
      <div className="bg-midnight-900 border-b border-midnight-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-text-primary">Shortlisted Properties</h1>
              <p className="mt-2 text-text-secondary">
                Total: {shortlistedProperties.length} properties
              </p>
            </div>
            {shortlistedProperties.length > 0 && (
              <button
                onClick={handleClearAll}
                className="px-6 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-lg transition font-medium border border-red-500/30"
              >
                Clear All
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {shortlistedProperties.length === 0 ? (
          <div className="min-h-[400px] flex flex-col items-center justify-center">
            <div className="text-center">
              <svg
                className="w-16 h-16 text-text-secondary/40 mx-auto mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                />
              </svg>
              <h2 className="text-2xl font-bold text-text-primary mb-2">No Shortlisted Properties</h2>
              <p className="text-text-secondary mb-6">
                You haven't shortlisted any properties yet. Start exploring properties by clicking the heart icon.
              </p>
              <Link
                to="/properties"
                className="inline-block px-6 py-3 bg-[#dc2626] text-white rounded-lg hover:bg-[#b91c1c] transition font-medium"
              >
                Explore Properties
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Active Listings */}
            {groupedProperties.active.length > 0 && (
              <div>
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-text-primary flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    Active Auctions ({groupedProperties.active.length})
                  </h2>
                  <p className="text-text-secondary mt-2">
                    Auctions still available for bidding
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {groupedProperties.active.map((property) => renderPropertyCard(property))}
                </div>
              </div>
            )}

            {/* Expired Listings */}
            {groupedProperties.expired.length > 0 && (
              <div>
                <div className="mb-6 pt-8 border-t border-midnight-700">
                  <h2 className="text-2xl font-bold text-text-primary flex items-center gap-2">
                    <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                    Expired Auctions ({groupedProperties.expired.length})
                  </h2>
                  <p className="text-text-secondary mt-2">
                    These auctions have ended. You can remove them from your shortlist.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 opacity-75">
                  {groupedProperties.expired.map((property) => renderPropertyCard(property))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default Shortlisted;
