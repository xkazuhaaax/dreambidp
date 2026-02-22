import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { propertiesAPI } from '../../services/api';
import { getImageUrl } from '../../utils/imageUrl';
import toast from 'react-hot-toast';

function PropertyForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = !!id;

  const { data: propertyData } = useQuery(
    ['property', id],
    () => propertiesAPI.getById(id),
    { enabled: isEdit }
  );

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    property_type: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    country: 'India',
    latitude: '',
    longitude: '',
    area_sqft: '',
    bedrooms: '',
    bathrooms: '',
    floors: '',
    reserve_price: '',
    auction_date: '',
    auction_time: '',
    auction_status: 'upcoming',
    is_featured: false,
    estimated_market_value: '',
    built_up_area: '',
    total_area: '',
    emd: '',
    possession_type: '',
    application_end_date: '',
  });

  const [images, setImages] = useState([]);
  const [existingImages, setExistingImages] = useState([]);
  const [pdfFile, setPdfFile] = useState(null);

  useEffect(() => {
    if (propertyData?.data?.property) {
      const prop = propertyData.data.property;
      setFormData({
        title: prop.title || '',
        description: prop.description || '',
        property_type: prop.property_type || '',
        address: prop.address || '',
        city: prop.city || '',
        state: prop.state || '',
        zip_code: prop.zip_code || '',
        country: prop.country || 'India',
        latitude: prop.latitude || '',
        longitude: prop.longitude || '',
        area_sqft: prop.area_sqft || '',
        bedrooms: prop.bedrooms || '',
        bathrooms: prop.bathrooms || '',
        floors: prop.floors || '',
        reserve_price: prop.reserve_price || '',
        auction_date: prop.auction_date ? prop.auction_date.split('T')[0] : '',
        auction_time: prop.auction_time || '',
        auction_status: prop.auction_status || 'upcoming',
        is_featured: prop.is_featured || false,
        estimated_market_value: prop.estimated_market_value || '',
        built_up_area: prop.built_up_area || '',
        total_area: prop.total_area || '',
        emd: prop.emd || '',
        possession_type: prop.possession_type || '',
        application_end_date: prop.application_end_date ? prop.application_end_date.split('T')[0] : '',
      });
      setExistingImages(prop.images || []);
    }
  }, [propertyData]);

  const createMutation = useMutation(
    (formDataToSend) => propertiesAPI.create(formDataToSend),
    {
      onSuccess: () => {
        toast.success('Property created successfully!');
        // Invalidate all property-related queries
        queryClient.invalidateQueries('properties');
        queryClient.invalidateQueries(['properties']);
        navigate('/admin/properties');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to create property');
      },
    }
  );

  const updateMutation = useMutation(
    (formDataToSend) => propertiesAPI.update(id, formDataToSend),
    {
      onSuccess: () => {
        toast.success('Property updated successfully!');
        // Invalidate all property-related queries
        queryClient.invalidateQueries('properties');
        queryClient.invalidateQueries(['properties']);
        queryClient.invalidateQueries(['property', id]);
        navigate('/admin/properties');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to update property');
      },
    }
  );

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 20) {
      toast.error('Maximum 20 images allowed');
      setImages(files.slice(0, 20));
    } else {
      setImages(files);
    }
  };

  const handlePdfChange = (e) => {
    setPdfFile(e.target.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const submitData = new FormData();
    Object.keys(formData).forEach(key => {
      if (formData[key] !== '' && formData[key] !== null) {
        submitData.append(key, formData[key]);
      }
    });

    // Add images
    images.forEach((image, index) => {
      if (index === 0) {
        submitData.append('cover_image', image);
      }
      submitData.append('images', image);
    });

    if (isEdit) {
      updateMutation.mutate(submitData);
    } else {
      createMutation.mutate(submitData);
    }
  };

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">
        {isEdit ? 'Edit Property' : 'Add New Property'}
      </h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
        {/* Basic Information */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Basic Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title *
              </label>
              <input
                type="text"
                name="title"
                required
                value={formData.title}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Property Type
              </label>
              <select
                name="property_type"
                value={formData.property_type}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="">Select Type</option>
                <option value="house">House</option>
                <option value="apartment">Apartment</option>
                <option value="land">Land</option>
                <option value="commercial">Commercial</option>
                <option value="villa">Villa</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
          </div>
        </div>

        {/* Location */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Location</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address *
              </label>
              <input
                type="text"
                name="address"
                required
                value={formData.address}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                City *
              </label>
              <input
                type="text"
                name="city"
                required
                value={formData.city}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                State
              </label>
              <input
                type="text"
                name="state"
                value={formData.state}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Zip Code
              </label>
              <input
                type="text"
                name="zip_code"
                value={formData.zip_code}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Latitude
              </label>
              <input
                type="number"
                step="any"
                name="latitude"
                value={formData.latitude}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Longitude
              </label>
              <input
                type="number"
                step="any"
                name="longitude"
                value={formData.longitude}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
          </div>
        </div>

        {/* Property Details */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Property Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Area (sq ft)
              </label>
              <input
                type="number"
                name="area_sqft"
                value={formData.area_sqft}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Built-Up Area (sq ft)
              </label>
              <input
                type="number"
                step="0.01"
                name="built_up_area"
                value={formData.built_up_area}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Total Area (sq ft)
              </label>
              <input
                type="number"
                step="0.01"
                name="total_area"
                value={formData.total_area}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bedrooms
              </label>
              <input
                type="number"
                name="bedrooms"
                value={formData.bedrooms}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bathrooms
              </label>
              <input
                type="number"
                name="bathrooms"
                value={formData.bathrooms}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Floors
              </label>
              <input
                type="number"
                name="floors"
                value={formData.floors}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
          </div>
        </div>

        {/* Auction Details */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Auction Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reserve Price (₹) *
              </label>
              <input
                type="number"
                name="reserve_price"
                required
                value={formData.reserve_price}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Estimated Market Value (₹)
              </label>
              <input
                type="number"
                step="0.01"
                name="estimated_market_value"
                value={formData.estimated_market_value}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                EMD - Earnest Money Deposit (₹)
              </label>
              <input
                type="number"
                step="0.01"
                name="emd"
                value={formData.emd}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Auction Date
              </label>
              <input
                type="date"
                name="auction_date"
                value={formData.auction_date}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Auction Time
              </label>
              <input
                type="time"
                name="auction_time"
                value={formData.auction_time}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Application End Date
              </label>
              <input
                type="date"
                name="application_end_date"
                value={formData.application_end_date}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Possession Type
              </label>
              <select
                name="possession_type"
                value={formData.possession_type}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="">Select Possession Type</option>
                <option value="Physical">Physical Possession</option>
                <option value="Virtual">Virtual Possession</option>
              </select>
            </div>
            {isEdit && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  name="auction_status"
                  value={formData.auction_status}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  <option value="upcoming">Upcoming</option>
                  <option value="active">Active</option>
                  <option value="expired">Expired</option>
                  <option value="sold">Sold</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            )}
            <div className="flex items-center">
              <input
                type="checkbox"
                name="is_featured"
                checked={formData.is_featured}
                onChange={handleChange}
                className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
              />
              <label className="ml-2 block text-sm text-gray-700">
                Featured Property
              </label>
            </div>
          </div>
        </div>

        {/* Images */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Images</h2>
          {existingImages.length > 0 && (
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">Existing Images:</p>
              <div className="flex flex-wrap gap-2">
                {existingImages.map((img, idx) => (
                  <img
                    key={idx}
                    src={getImageUrl(img.image_url)}
                    alt={`Property ${idx + 1}`}
                    className="h-20 w-20 object-cover rounded"
                  />
                ))}
              </div>
            </div>
          )}
          <div>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <div className="mt-2 flex justify-between text-sm">
              <p className="text-gray-500">First image will be used as cover image</p>
              <p className="text-gray-600 font-medium">Images selected: {images.length} / 20</p>
            </div>
          </div>
        </div>

        {/* PDF */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Property Brochure (PDF)</h2>
          <input
            type="file"
            accept=".pdf"
            onChange={handlePdfChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>

        {/* Submit Buttons */}
        <div className="flex justify-end gap-4 pt-4 border-t">
          <button
            type="button"
            onClick={() => navigate('/admin/properties')}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={createMutation.isLoading || updateMutation.isLoading}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
          >
            {createMutation.isLoading || updateMutation.isLoading
              ? 'Saving...'
              : isEdit
              ? 'Update Property'
              : 'Create Property'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default PropertyForm;
