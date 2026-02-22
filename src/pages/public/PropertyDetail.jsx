import { useState, useMemo, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation } from 'react-query';
import { propertiesAPI, enquiriesAPI, interestsAPI } from '../../services/api';
import { contactViaWhatsApp, shareProperty } from '../../utils/whatsapp';
import { getImageUrl } from '../../utils/imageUrl';
import { useShortlist } from '../../contexts/ShortlistContext';
import { GoogleMap, LoadScript, Marker, InfoWindow } from '@react-google-maps/api';
import toast from 'react-hot-toast';

const mapContainerStyle = {
  width: '100%',
  height: '400px',
};

const mapOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  streetViewControl: true,
  mapTypeControl: true,
  fullscreenControl: true,
  styles: [
    {
      featureType: 'poi',
      elementType: 'labels',
      stylers: [{ visibility: 'off' }]
    }
  ]
};

const buyingProcessSteps = [
  { 
    number: 1, 
    title: 'Choose a Property', 
    description: 'Explore our listings & find a property that meets your requirements.',
    icon: 'M12 19l9 2-9-18-9 18 9-2zm0 0v-8'
  },
  { 
    number: 2, 
    title: 'Pay EMD', 
    description: 'Pay 10% earnest money deposit as an assurance of interest in the property.',
    icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
  },
  { 
    number: 3, 
    title: 'Submit Application', 
    description: 'Submit the Common Application Form (CAF) and prepare for auction.',
    icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
  },
  { 
    number: 4, 
    title: 'Participate in Auction', 
    description: 'Register with the auction portal and take part in the bidding process.',
    icon: 'M17 20h5v-2a3 3 0 00-5.856-1.487M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 0a2 2 0 11-4 0 2 2 0 014 0zM5 20a6 6 0 0110-12 6 6 0 0110 12H5z'
  },
  { 
    number: 5, 
    title: 'Auction Outcome', 
    description: 'If you win, pay 15%. If you lose, get the EMD refund.',
    icon: 'M13 10V3L4 14h7v7l9-11h-7z'
  },
  { 
    number: 6, 
    title: 'Pay 75% in 15 Days', 
    description: 'Pay the remaining 75% within 15 Days to start the registration process.',
    icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'
  },
  { 
    number: 7, 
    title: 'Obtain Sale Certificate', 
    description: 'The seller institution issues the sale certificate after payment completion.',
    icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
  },
  { 
    number: 8, 
    title: 'Register the Property', 
    description: 'Authorized officer registers the property in the Sub-Registrar Office.',
    icon: 'M3 12l2-3m0 0l7-4 7 4M5 9v10a1 1 0 001 1h12a1 1 0 001-1V9m-9 16l4-4m0 0l4 4m-4-4V5'
  },
];

function PropertyDetail() {
  const { id } = useParams();
  const { toggleShortlist, isShortlisted } = useShortlist();
  const [enquiryForm, setEnquiryForm] = useState({
    name: '',
    email: '',
    phone: '',
    message: '',
  });
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showInfoWindow, setShowInfoWindow] = useState(true);
  const [showTimeline, setShowTimeline] = useState(true);
  const [kycFile, setKycFile] = useState(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [isCarouselAutoScroll, setIsCarouselAutoScroll] = useState(true);
  const carouselResumeTimeoutRef = useRef(null);

  const { data, isLoading, error } = useQuery(
    ['property', id],
    () => propertiesAPI.getById(id),
    {
      enabled: !!id,
      onSuccess: () => {
        interestsAPI.track({ property_id: parseInt(id), interest_type: 'view' });
      },
    }
  );

  const enquiryMutation = useMutation(
    (data) => enquiriesAPI.create(data),
    {
      onSuccess: () => {
        toast.success('Expression of Interest submitted successfully!');
        setEnquiryForm({ name: '', email: '', phone: '', message: '' });
        setKycFile(null);
        setAcceptedTerms(false);
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to submit enquiry');
      },
    }
  );

  const property = data?.data?.property;

  // Fetch similar properties from the same city
  const { data: similarPropertiesData, isLoading: similarLoading } = useQuery(
    ['similarProperties', property?.city],
    () => {
      if (!property?.city) return Promise.resolve({ data: { properties: [] } });
      return propertiesAPI.getAll({ city: property.city, limit: 6 });
    },
    {
      enabled: !!property?.city,
    }
  );

  const similarProperties = useMemo(() => {
    if (!similarPropertiesData?.data?.properties) return [];
    // Filter out the current property from similar properties
    return similarPropertiesData.data.properties.filter(p => p.id !== parseInt(id)).slice(0, 5);
  }, [similarPropertiesData, id]);

  const center = useMemo(() => {
    if (property?.latitude && property?.longitude) {
      return { lat: parseFloat(property.latitude), lng: parseFloat(property.longitude) };
    }
    return null;
  }, [property?.latitude, property?.longitude]);

  const handleEnquirySubmit = (e) => {
    e.preventDefault();
    enquiryMutation.mutate({
      property_id: parseInt(id),
      ...enquiryForm,
    });
  };

  const handleWhatsAppContact = () => {
    contactViaWhatsApp(property, enquiryForm);
    interestsAPI.track({ property_id: parseInt(id), interest_type: 'contact' });
  };

  const handleGetDirections = () => {
    if (center) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${center.lat},${center.lng}`;
      window.open(url, '_blank');
    }
  };

  const handleViewOnGoogleMaps = () => {
    if (center) {
      const url = `https://www.google.com/maps/search/?api=1&query=${center.lat},${center.lng}`;
      window.open(url, '_blank');
    }
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
      setKycFile(file);
    } else {
      toast.error('Please upload a PDF file');
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      setKycFile(file);
    } else {
      toast.error('Please upload a PDF file');
    }
  };

  // Handle carousel interaction - pause auto-scroll and resume after 8 seconds
  const handleCarouselInteraction = () => {
    setIsCarouselAutoScroll(false);
    
    // Clear existing timeout if any
    if (carouselResumeTimeoutRef.current) {
      clearTimeout(carouselResumeTimeoutRef.current);
    }
    
    // Set new timeout to resume auto-scroll after 8 seconds
    carouselResumeTimeoutRef.current = setTimeout(() => {
      setIsCarouselAutoScroll(true);
    }, 8000);
  };

  // Auto-scroll effect for carousel
  useEffect(() => {
    if (!isCarouselAutoScroll) return;

    const timer = setInterval(() => {
      setCarouselIndex(prev => {
        // Get the carousel images count from property data
        let carouselImageCount = 0;
        if (property?.cover_image_url) carouselImageCount++;
        if (property?.images && property.images.length > 0) {
          carouselImageCount += property.images.filter(img => {
            const imgUrl = typeof img === 'object' ? img.image_url : img;
            return imgUrl !== property?.cover_image_url;
          }).length;
        }
        
        if (carouselImageCount <= 1) return prev;
        return (prev + 1) % carouselImageCount;
      });
    }, 4000);

    return () => clearInterval(timer);
  }, [isCarouselAutoScroll, property?.cover_image_url, property?.images]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-midnight-950 flex items-center justify-center">
        <div className="text-text-secondary">Loading property details...</div>
      </div>
    );
  }

  if (error || !property) {
    return (
      <div className="min-h-screen bg-midnight-950 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-midnight-900 border border-red-900 rounded-xl shadow-sm p-6">
            <p className="text-red-400">Property not found or error loading property.</p>
            <Link to="/properties" className="text-red-400 hover:text-red-300 mt-4 inline-block font-medium">
              ← Back to Properties
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-midnight-950">
      {/* Image Modal */}
      {showImageModal && ((property.images && property.images.length > 0) || property.cover_image_url) && (() => {
        const allImages = [];
        if (property.cover_image_url) {
          allImages.push(property.cover_image_url);
        }
        if (property.images && property.images.length > 0) {
          property.images.forEach(img => {
            const imgUrl = typeof img === 'object' ? img.image_url : img;
            if (imgUrl !== property.cover_image_url) {
              allImages.push(imgUrl);
            }
          });
        }
        const currentImage = allImages[selectedImageIndex] || allImages[0];

        return (
          <div
            className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4"
            onClick={() => setShowImageModal(false)}
          >
            <button
              onClick={() => setShowImageModal(false)}
              className="absolute top-4 right-4 text-white hover:text-red-500 transition-colors z-10"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            {allImages.length > 1 && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedImageIndex((prev) => (prev > 0 ? prev - 1 : allImages.length - 1));
                  }}
                  className="absolute left-4 text-white hover:text-red-500 transition-colors z-10 bg-black bg-opacity-50 rounded-full p-2"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedImageIndex((prev) => (prev < allImages.length - 1 ? prev + 1 : 0));
                  }}
                  className="absolute right-4 text-white hover:text-red-500 transition-colors z-10 bg-black bg-opacity-50 rounded-full p-2"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </>
            )}
            <div className="max-w-7xl max-h-full" onClick={(e) => e.stopPropagation()}>
              <img
                src={getImageUrl(currentImage)}
                alt={property.title}
                className="max-w-full max-h-[90vh] object-contain rounded-lg"
                onError={(e) => {
                  console.error('Image failed to load:', e.target.src);
                  e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%23ddd" width="400" height="300"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3ENo Image%3C/text%3E%3C/svg%3E';
                }}
              />
              {allImages.length > 1 && (
                <div className="text-center text-white mt-4">
                  <span className="text-sm">{selectedImageIndex + 1} / {allImages.length}</span>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Left Column - Property Content (70%) */}
          <div className="flex-1 space-y-8">
            {/* Property Header */}
            <div className="bg-midnight-900 border border-midnight-700 rounded-2xl shadow-sm p-4 lg:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 bg-midnight-800 text-text-secondary text-sm font-medium rounded-lg">
                    Property ID: {property.id}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        toggleShortlist(property);
                        toast.success(isShortlisted(property.id) ? 'Removed from shortlist' : 'Added to shortlist');
                      }}
                      className="p-2 rounded-lg hover:bg-[#F7F9FC] transition-colors"
                      title={isShortlisted(property.id) ? 'Remove from shortlist' : 'Add to shortlist'}
                    >
                      <svg className={`w-5 h-5 ${isShortlisted(property.id) ? 'text-red-500 fill-current' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                    </button>
                    <button
                      onClick={handleWhatsAppContact}
                      className="p-2 rounded-lg hover:bg-[#F7F9FC] transition-colors"
                    >
                      <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .96 4.534.96 10.08c0 1.752.413 3.4 1.141 4.865L.06 23.884l9.251-2.39a11.717 11.717 0 005.739 1.49h.005c6.554 0 11.09-5.533 11.09-11.088a11.106 11.106 0 00-3.291-7.918"/>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
              
              <h1 className="text-xl lg:text-2xl font-bold text-text-primary mb-4">
                {property.title}
              </h1>
              
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-text-secondary">Reserve Price:</span>
                  <span className="text-xl lg:text-2xl font-bold text-text-primary">
                    ₹{property.reserve_price ? property.reserve_price.toLocaleString() : 'N/A'}
                  </span>
                </div>
                {property.estimated_market_value && (
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-green-500/20 text-green-300 text-sm font-medium rounded-lg border border-green-500/30">
                      Est. Market Value: ₹{property.estimated_market_value.toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Property Details & Auction Details */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Property Details Card */}
              <div className="bg-midnight-900 border border-midnight-700 rounded-2xl shadow-sm p-6">
                <h3 className="text-lg font-semibold text-text-primary mb-4">Property Details</h3>
                <div className="space-y-3">
                  {property.property_type && (
                    <div className="flex justify-between">
                      <span className="text-sm text-text-secondary">Property Type</span>
                      <span className="text-sm font-medium text-text-primary">{property.property_type}</span>
                    </div>
                  )}
                  {property.area && (
                    <div className="flex justify-between">
                      <span className="text-sm text-text-secondary">Area</span>
                      <span className="text-sm font-medium text-text-primary">{property.area} sq.ft.</span>
                    </div>
                  )}
                  {property.built_up_area && (
                    <div className="flex justify-between">
                      <span className="text-sm text-text-secondary">Built-Up Area</span>
                      <span className="text-sm font-medium text-text-primary">{property.built_up_area} sq.ft.</span>
                    </div>
                  )}
                  {property.total_area && (
                    <div className="flex justify-between">
                      <span className="text-sm text-text-secondary">Total Area</span>
                      <span className="text-sm font-medium text-text-primary">{property.total_area} sq.ft.</span>
                    </div>
                  )}
                  {property.bedrooms > 0 && (
                    <div className="flex justify-between">
                      <span className="text-sm text-text-secondary">Bedrooms</span>
                      <span className="text-sm font-medium text-text-primary">{property.bedrooms}</span>
                    </div>
                  )}
                  {property.bathrooms > 0 && (
                    <div className="flex justify-between">
                      <span className="text-sm text-text-secondary">Bathrooms</span>
                      <span className="text-sm font-medium text-text-primary">{property.bathrooms}</span>
                    </div>
                  )}
                  {property.city && (
                    <div className="flex justify-between">
                      <span className="text-sm text-text-secondary">City</span>
                      <span className="text-sm font-medium text-text-primary">{property.city}</span>
                    </div>
                  )}
                  {property.state && (
                    <div className="flex justify-between">
                      <span className="text-sm text-text-secondary">State</span>
                      <span className="text-sm font-medium text-text-primary">{property.state}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Auction Details Card */}
              <div className="bg-midnight-900 border border-midnight-700 rounded-2xl shadow-sm p-6">
                <h3 className="text-lg font-semibold text-text-primary mb-4">Auction Details</h3>
                <div className="space-y-3">
                  {property.auction_date && (
                    <div className="flex justify-between">
                      <span className="text-sm text-text-secondary">Auction Date</span>
                      <span className="text-sm font-medium text-text-primary">
                        {new Date(property.auction_date).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  {property.auction_time && (
                    <div className="flex justify-between">
                      <span className="text-sm text-text-secondary">Auction Time</span>
                      <span className="text-sm font-medium text-text-primary">
                        {property.auction_time}
                      </span>
                    </div>
                  )}
                  {property.application_end_date && (
                    <div className="flex justify-between">
                      <span className="text-sm text-text-secondary">Application End Date</span>
                      <span className="text-sm font-medium text-text-primary">
                        {new Date(property.application_end_date).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  {property.emd && (
                    <div className="flex justify-between">
                      <span className="text-sm text-text-secondary">EMD Amount</span>
                      <span className="text-sm font-medium text-text-primary">
                        ₹{property.emd.toLocaleString()}
                      </span>
                    </div>
                  )}
                  {property.possession_type && (
                    <div className="flex justify-between">
                      <span className="text-sm text-text-secondary">Possession Type</span>
                      <span className="text-sm font-medium text-text-primary">
                        {property.possession_type}
                      </span>
                    </div>
                  )}
                  {property.earnest_money_deposit && (
                    <div className="flex justify-between">
                      <span className="text-sm text-text-secondary">EMD (Legacy)</span>
                      <span className="text-sm font-medium text-text-primary">
                        ₹{property.earnest_money_deposit.toLocaleString()}
                      </span>
                    </div>
                  )}
                  {property.status && (
                    <div className="flex justify-between">
                      <span className="text-sm text-text-secondary">Status</span>
                      <span className={`text-sm font-medium px-2 py-1 rounded-lg ${
                        property.status === 'upcoming' ? 'bg-blue-500/20 text-blue-300' :
                        property.status === 'active' ? 'bg-green-500/20 text-green-300' :
                        property.status === 'expired' ? 'bg-red-500/20 text-red-300' :
                        property.status === 'sold' ? 'bg-purple-500/20 text-purple-300' :
                        'bg-gray-500/20 text-gray-300'
                      }`}>
                        {property.status.charAt(0).toUpperCase() + property.status.slice(1)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Auto-Scrolling Carousel Section */}
            {((property.images && property.images.length > 0) || property.cover_image_url) && (() => {
              const allImages = [];
              if (property.cover_image_url) {
                allImages.push(property.cover_image_url);
              }
              if (property.images && property.images.length > 0) {
                property.images.forEach(img => {
                  const imgUrl = typeof img === 'object' ? img.image_url : img;
                  if (imgUrl !== property.cover_image_url) {
                    allImages.push(imgUrl);
                  }
                });
              }

              if (allImages.length === 0) return null;

              return (
                <div className="bg-midnight-900 border border-midnight-700 rounded-2xl shadow-sm p-6">
                  <h3 className="text-lg font-semibold text-text-primary mb-4">Property Gallery</h3>
                  <div className="relative">
                    {/* Main Carousel Display */}
                    <div className="relative bg-gray-900 rounded-xl overflow-hidden aspect-video">
                      <img
                        src={getImageUrl(allImages[carouselIndex])}
                        alt={`Property ${carouselIndex + 1}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%23333" width="400" height="300"/%3E%3Ctext fill="%23666" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3ENo Image%3C/text%3E%3C/svg%3E';
                        }}
                      />
                      
                      {/* Navigation Arrows */}
                      {allImages.length > 1 && (
                        <>
                          <button
                            onClick={() => {
                              setCarouselIndex(prev => prev > 0 ? prev - 1 : allImages.length - 1);
                              handleCarouselInteraction();
                            }}
                            className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors z-10"
                          >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                          </button>
                          <button
                            onClick={() => {
                              setCarouselIndex(prev => prev < allImages.length - 1 ? prev + 1 : 0);
                              handleCarouselInteraction();
                            }}
                            className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors z-10"
                          >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        </>
                      )}
                      
                      {/* Image Counter */}
                      {allImages.length > 1 && (
                        <div className="absolute top-4 right-4 bg-black/70 text-white px-3 py-1 rounded-full text-sm font-medium">
                          {carouselIndex + 1} / {allImages.length}
                        </div>
                      )}

                      {/* Auto-scroll Indicator */}
                      {allImages.length > 1 && (
                        <div className="absolute bottom-4 left-4 text-white text-xs bg-black/70 px-3 py-1 rounded-full">
                          {isCarouselAutoScroll ? '🔄 Auto-scrolling' : 'Manual mode'}
                        </div>
                      )}
                    </div>

                    {/* Thumbnail Strip */}
                    {allImages.length > 1 && (
                      <div className="mt-4 overflow-x-auto scrollbar-hide">
                        <div className="flex gap-2 min-w-max pb-2">
                          {allImages.map((img, index) => (
                            <button
                              key={index}
                              onClick={() => {
                                setCarouselIndex(index);
                                handleCarouselInteraction();
                              }}
                              className={`flex-shrink-0 h-16 w-20 rounded-lg overflow-hidden border-2 transition-all ${
                                carouselIndex === index
                                  ? 'border-[#dc2626] ring-2 ring-[#dc2626]'
                                  : 'border-gray-300 hover:border-gray-400'
                              }`}
                            >
                              <img
                                src={getImageUrl(img)}
                                alt={`Thumbnail ${index + 1}`}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23ddd" width="100" height="100"/%3E%3C/svg%3E';
                                }}
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
            {/* Map Section */}
            {center && (
              <div className="bg-midnight-900 border border-midnight-700 rounded-2xl shadow-sm p-6">
                <h3 className="text-lg font-semibold text-text-primary mb-4">Location</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Street View</h4>
                    <div className="aspect-video rounded-lg overflow-hidden bg-midnight-800">
                      <iframe
                        src={`https://maps.google.com/maps?q=${center.lat},${center.lng}&layer=c&cbll=${center.lat},${center.lng}&cbp=11,0,0,0,0`}
                        className="w-full h-full border-0"
                        allowFullScreen
                        loading="lazy"
                      />
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Exact Location</h4>
                    <div className="aspect-video rounded-lg overflow-hidden">
                      <LoadScript googleMapsApiKey="YOUR_API_KEY">
                        <GoogleMap
                          mapContainerStyle={mapContainerStyle}
                          center={center}
                          zoom={15}
                          options={mapOptions}
                        >
                          <Marker position={center} />
                        </GoogleMap>
                      </LoadScript>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={handleGetDirections}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm font-medium"
                  >
                    Get Directions
                  </button>
                  <button
                    onClick={handleViewOnGoogleMaps}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm font-medium"
                  >
                    View on Google Maps
                  </button>
                </div>
              </div>
            )}

            {/* Information Section */}
            <div className="bg-midnight-900 border border-midnight-700 rounded-2xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-text-primary mb-6">Property Information</h3>
              <div className="space-y-6">
                <div>
                  <h4 className="font-medium text-text-primary mb-2">Seller's Reserve Price</h4>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    The reserve price is the minimum price the seller is willing to accept for the property. 
                    Bids below this price will not be considered. The reserve price is confidential and 
                    not disclosed to bidders.
                  </p>
                </div>

                <div>
                  <h4 className="font-medium text-text-primary mb-2">Estimated Market Value</h4>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    This is an approximate valuation of the property based on current market conditions, 
                    location, property features, and recent comparable sales in the area. This is for 
                    reference purposes only and may not reflect the final auction price.
                  </p>
                </div>

                <div>
                  <h4 className="font-medium text-text-primary mb-2">Earnest Money Deposit (EMD)</h4>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    EMD is a security deposit that must be paid by interested bidders to participate in 
                    the auction. This amount is refundable to unsuccessful bidders and adjusted against 
                    the final payment for successful bidders.
                  </p>
                </div>

                <div>
                  <h4 className="font-medium text-text-primary mb-2">Loan Availability</h4>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    Financial institutions may provide loans for eligible properties. Subject to 
                    bank's terms, conditions, and approval processes. Buyers are advised to check 
                    loan eligibility before participating in the auction.
                  </p>
                </div>

                <div>
                  <h4 className="font-medium text-text-primary mb-2">Request a Visit of the Property</h4>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    Interested buyers can schedule a property visit by contacting our team. 
                    Site visits are subject to availability and must be scheduled in advance. 
                    Please bring valid identification for verification.
                  </p>
                </div>

                <div>
                  <h4 className="font-medium text-text-primary mb-2">Possession Status</h4>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    The possession timeline varies depending on the property type and legal status. 
                    Typically, possession is handed over within 30-90 days after successful payment 
                    completion and legal formalities.
                  </p>
                </div>

                <div>
                  <h4 className="font-medium text-text-primary mb-2">CERSAI Report</h4>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    Central Registry of Securitisation Asset Reconstruction and Security Interest of India 
                    report provides information about any existing securities or mortgages on the property.
                  </p>
                </div>

                <div>
                  <h4 className="font-medium text-text-primary mb-2">Encumbrance Certificate</h4>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    This certificate confirms that the property is free from any legal or financial 
                    liabilities. It's a crucial document that verifies the clear title of the property.
                  </p>
                </div>

                <div>
                  <h4 className="font-medium text-text-primary mb-2">Payment Process for Repossessed Properties</h4>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    Payment must be completed within the specified timeframe after winning the bid. 
                    The process includes EMD adjustment, remaining payment, and documentation. 
                    Detailed payment instructions will be provided to successful bidders.
                  </p>
                </div>

                <div>
                  <h4 className="font-medium text-text-primary mb-2">SARFAESI Act</h4>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    The Securitisation and Reconstruction of Financial Assets and Enforcement of 
                    Security Interest Act enables banks to recover their dues without intervention 
                    of the court, making the auction process more efficient.
                  </p>
                </div>

                <div className="pt-4 border-t border-gray-200">
                  <p className="text-xs text-text-muted">
                    <strong>Disclaimer:</strong> The information provided is for reference purposes only. 
                    Buyers are advised to conduct independent due diligence and verify all details before 
                    making any purchase decisions. The platform is not responsible for any inaccuracies 
                    or discrepancies in the information provided.
                  </p>
                </div>
              </div>
            </div>

            {/* More Properties Section */}
            {!similarLoading && similarProperties.length > 0 && (
              <div className="bg-midnight-900 border border-midnight-700 rounded-2xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-text-primary">
                    More Properties in {property?.city}
                  </h3>
                  <Link
                    to={`/properties?city=${property?.city}`}
                    className="text-sm text-[#dc2626] hover:text-[#b91c1c] font-medium transition"
                  >
                    View All →
                  </Link>
                </div>
                <div className="overflow-x-auto lg:overflow-x-hidden scrollbar-hide">
                  <div className="flex gap-4 min-w-max lg:min-w-0 lg:grid lg:grid-cols-3">
                    {similarProperties.map((prop) => (
                      <Link
                        key={prop.id}
                        to={`/properties/${prop.id}`}
                        className="group flex-shrink-0 lg:flex-shrink w-64 lg:w-full hover:shadow-lg transition-shadow rounded-xl overflow-hidden border border-midnight-700 hover:border-midnight-600 hover:bg-midnight-800"
                      >
                        <div className="flex flex-col h-full">
                          {/* Property Image */}
                          <div className="h-40 overflow-hidden bg-midnight-800">
                            <img
                              src={getImageUrl(prop.cover_image_url)}
                              alt={prop.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              onError={(e) => {
                                e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="200"%3E%3Crect fill="%23ddd" width="300" height="200"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3ENo Image%3C/text%3E%3C/svg%3E';
                              }}
                            />
                          </div>

                          {/* Property Details */}
                          <div className="flex-1 p-4 flex flex-col">
                            <h4 className="font-semibold text-text-primary text-sm line-clamp-2 group-hover:text-gold transition mb-2">
                              {prop.title}
                            </h4>
                            <p className="text-xs text-text-muted mb-2">
                              {prop.city}{prop.state ? `, ${prop.state}` : ''}
                            </p>
                            <div className="flex items-center gap-4 mt-auto text-xs mb-3">
                              {prop.bedrooms && (
                                <span className="text-text-secondary">
                                  <span className="font-medium text-text-primary">{prop.bedrooms}</span> BHK
                                </span>
                              )}
                              {prop.area_sqft && (
                                <span className="text-text-secondary">
                                  <span className="font-medium text-text-primary">{Math.round(prop.area_sqft)}</span> sq.ft.
                                </span>
                              )}
                            </div>
                            <p className="text-sm font-bold text-text-primary">
                              ₹{prop.reserve_price ? prop.reserve_price.toLocaleString() : 'N/A'}
                            </p>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Sticky Sidebar (30%) */}
          <div className="lg:w-[400px] lg:sticky lg:top-8 lg:h-fit space-y-6">
            {/* Expression of Interest Form */}
            <div className="bg-gray-900 rounded-2xl shadow-sm p-6">
              <h3 className="text-xl font-bold text-white mb-6">Expression of Interest</h3>
              <form onSubmit={handleEnquirySubmit} className="space-y-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1 font-medium uppercase tracking-wide">Name *</label>
                  <input
                    type="text"
                    required
                    value={enquiryForm.name}
                    onChange={(e) => setEnquiryForm({ ...enquiryForm, name: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-800 text-white rounded-xl border border-gray-700 focus:outline-none focus:border-[#dc2626] focus:ring-1 focus:ring-[#dc2626] text-sm"
                    placeholder="Enter your name"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1 font-medium uppercase tracking-wide">Contact Number *</label>
                  <input
                    type="tel"
                    required
                    value={enquiryForm.phone}
                    onChange={(e) => setEnquiryForm({ ...enquiryForm, phone: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-800 text-white rounded-xl border border-gray-700 focus:outline-none focus:border-[#dc2626] focus:ring-1 focus:ring-[#dc2626] text-sm"
                    placeholder="Enter phone number"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1 font-medium uppercase tracking-wide">Email *</label>
                  <input
                    type="email"
                    required
                    value={enquiryForm.email}
                    onChange={(e) => setEnquiryForm({ ...enquiryForm, email: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-800 text-white rounded-xl border border-gray-700 focus:outline-none focus:border-[#dc2626] focus:ring-1 focus:ring-[#dc2626] text-sm"
                    placeholder="Enter email address"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1 font-medium uppercase tracking-wide">KYC Document</label>
                  <div
                    onDrop={handleFileDrop}
                    onDragOver={(e) => e.preventDefault()}
                    onClick={() => document.getElementById('kyc-upload').click()}
                    className="w-full px-4 py-6 bg-gray-800 border-2 border-dashed border-gray-700 rounded-xl text-center cursor-pointer hover:border-[#dc2626] transition-colors"
                  >
                    <input
                      id="kyc-upload"
                      type="file"
                      accept=".pdf"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    {kycFile ? (
                      <div className="text-[#dc2626]">
                        <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <p className="text-sm font-medium">{kycFile.name}</p>
                      </div>
                    ) : (
                      <div className="text-gray-400">
                        <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <p className="text-sm">Drag & drop or click to upload</p>
                        <p className="text-xs mt-1">PDF only</p>
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1 font-medium uppercase tracking-wide">Message</label>
                  <textarea
                    value={enquiryForm.message}
                    onChange={(e) => setEnquiryForm({ ...enquiryForm, message: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2.5 bg-gray-800 text-white rounded-xl border border-gray-700 focus:outline-none focus:border-[#dc2626] focus:ring-1 focus:ring-[#dc2626] text-sm resize-none"
                    placeholder="Enter your message..."
                  />
                </div>
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    id="terms"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    className="mt-1 w-4 h-4 rounded border-gray-600 bg-gray-800 text-[#dc2626] focus:ring-[#dc2626]"
                  />
                  <label htmlFor="terms" className="text-xs text-gray-400 leading-tight">
                    I agree to the <span className="text-[#dc2626]">Terms & Conditions</span> and <span className="text-[#dc2626]">Privacy Policy</span>
                  </label>
                </div>
                <button
                  type="submit"
                  disabled={enquiryMutation.isLoading || !acceptedTerms}
                  className="w-full px-6 py-3 bg-[#dc2626] text-white rounded-xl hover:bg-[#b91c1c] transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {enquiryMutation.isLoading ? 'Submitting...' : 'Submit'}
                </button>
              </form>

              <div className="mt-6 pt-6 border-t border-gray-700">
                <p className="text-xs text-gray-400 mb-3">Or contact us directly:</p>
                <button
                  onClick={handleWhatsAppContact}
                  className="w-full px-4 py-2.5 bg-green-500 text-white rounded-xl hover:bg-green-600 transition flex items-center justify-center gap-2 text-sm font-medium"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .96 4.534.96 10.08c0 1.752.413 3.4 1.141 4.865L.06 23.884l9.251-2.39a11.717 11.717 0 005.739 1.49h.005c6.554 0 11.09-5.533 11.09-11.088a11.106 11.106 0 00-3.291-7.918"/>
                  </svg>
                  WhatsApp
                </button>
              </div>
            </div>

            {/* Contact Us Card */}
            <div className="bg-gradient-to-br from-midnight-900 to-midnight-800 rounded-2xl shadow-sm p-6 space-y-4 border border-midnight-700">
              <h3 className="text-lg font-bold text-text-primary">Contact Us</h3>
              
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-midnight-800 flex items-center justify-center border border-midnight-700">
                    <svg className="w-5 h-5 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs text-text-muted uppercase font-semibold">Phone</p>
                    <a href="tel:+911140855500" className="text-sm font-semibold text-text-primary hover:text-gold transition">
                      +91 1140 8555 00
                    </a>
                  </div>
                </div>

                <button
                  onClick={handleWhatsAppContact}
                  className="w-full px-4 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl transition font-semibold text-sm flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .96 4.534.96 10.08c0 1.752.413 3.4 1.141 4.865L.06 23.884l9.251-2.39a11.717 11.717 0 005.739 1.49h.005c6.554 0 11.09-5.533 11.09-11.088a11.106 11.106 0 00-3.291-7.918"/>
                  </svg>
                  WhatsApp Us
                </button>
              </div>

              <div className="pt-4 border-t border-gray-200">
                <p className="text-xs text-text-muted text-center">
                  Need more information? Our team is here to help you!
                </p>
              </div>
            </div>

           
            {/* Buying Process Timeline */}
            <div className="bg-midnight-900 border border-midnight-700 rounded-2xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-text-primary mb-6">Your Buying Process</h3>
              <div className="space-y-4">
                {buyingProcessSteps.map((step, index) => (
                  <div key={step.number} className="flex items-start gap-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      index < 2 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {step.number}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-text-primary text-sm">{step.title}</h4>
                      <p className="text-xs text-text-muted mt-0.5">{step.description}</p>
                    </div>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                      index < 2 ? 'bg-green-50' : 'bg-gray-50'
                    }`}>
                      <svg className={`w-4 h-4 ${index < 2 ? 'text-green-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={step.icon} />
                      </svg>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Mobile Fixed Bottom CTA */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-midnight-900 border-t border-midnight-700 p-4 shadow-lg z-40">
        <button
          onClick={() => {
            const formElement = document.querySelector('.bg-gray-900');
            if (formElement) {
              formElement.scrollIntoView({ behavior: 'smooth' });
            }
          }}
          className="w-full px-6 py-3 bg-[#dc2626] text-white rounded-xl hover:bg-[#b91c1c] transition font-semibold"
        >
          Submit Expression of Interest
        </button>
      </div>
    </div>
  );
}

export default PropertyDetail;
