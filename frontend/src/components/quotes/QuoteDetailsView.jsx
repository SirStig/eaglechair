import { useState, useEffect } from 'react';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import {
  FileText,
  Clock,
  DollarSign,
  CheckCircle,
  XCircle,
  Package,
  Calendar,
  Mail,
  Phone,
  MapPin,
  Building2,
  Truck,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
} from 'lucide-react';
import { quoteService } from '../../services/quoteService';
import { formatPrice } from '../../utils/apiHelpers';

const QuoteDetailsView = ({ quoteId, onBack }) => {
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (quoteId) {
      loadQuoteDetails();
    }
  }, [quoteId]);

  const loadQuoteDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await quoteService.getQuoteById(quoteId);
      setQuote(data);
    } catch (err) {
      console.error('Error loading quote details:', err);
      setError('Failed to load quote details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      draft: { variant: 'default', icon: FileText, label: 'Draft' },
      submitted: { variant: 'info', icon: Clock, label: 'Submitted' },
      under_review: { variant: 'warning', icon: Clock, label: 'Under Review' },
      quoted: { variant: 'primary', icon: DollarSign, label: 'Quoted' },
      accepted: { variant: 'success', icon: CheckCircle, label: 'Accepted' },
      declined: { variant: 'danger', icon: XCircle, label: 'Declined' },
      expired: { variant: 'default', icon: XCircle, label: 'Expired' },
    };
    
    const config = statusConfig[status] || statusConfig.draft;
    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant} className="inline-flex items-center gap-1">
        <Icon className="w-3 h-3" />
        {config.label}
      </Badge>
    );
  };

  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return 'N/A';
    return formatPrice(amount);
  };

  const formatDateShort = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-dark-200">Loading quote details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={onBack} className="flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Quotes
        </Button>
        <Card className="p-6 bg-dark-700 border-dark-600">
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
            <div className="flex items-center gap-2 text-red-400">
              <AlertCircle className="w-5 h-5" />
              <p>{error}</p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (!quote) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header with Back Button */}
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={onBack} className="flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Quotes
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl md:text-3xl font-bold text-dark-50">
              {quote.project_name || 'Untitled Project'}
            </h1>
            {getStatusBadge(quote.status)}
          </div>
          <p className="text-dark-300">Quote #{quote.quote_number}</p>
        </div>
      </div>

      {/* Quote Information Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Contact Information */}
        <Card className="p-4 bg-dark-700 border-dark-600">
          <h3 className="text-lg font-semibold text-dark-50 mb-4 flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Contact Information
          </h3>
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-dark-400 mb-1">Contact Name</p>
              <p className="text-dark-50 font-medium">{quote.contact_name}</p>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-dark-400" />
              <p className="text-dark-50">{quote.contact_email}</p>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-dark-400" />
              <p className="text-dark-50">{quote.contact_phone}</p>
            </div>
          </div>
        </Card>

        {/* Project Details */}
        <Card className="p-4 bg-dark-700 border-dark-600">
          <h3 className="text-lg font-semibold text-dark-50 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Project Details
          </h3>
          <div className="space-y-3 text-sm">
            {quote.project_description && (
              <div>
                <p className="text-dark-400 mb-1">Description</p>
                <p className="text-dark-50">{quote.project_description}</p>
              </div>
            )}
            {quote.project_type && (
              <div>
                <p className="text-dark-400 mb-1">Project Type</p>
                <p className="text-dark-50">{quote.project_type}</p>
              </div>
            )}
            {quote.estimated_quantity && (
              <div>
                <p className="text-dark-400 mb-1">Estimated Quantity</p>
                <p className="text-dark-50">{quote.estimated_quantity} units</p>
              </div>
            )}
            {quote.desired_delivery_date && (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-dark-400" />
                <div>
                  <p className="text-dark-400 text-xs mb-1">Desired Delivery</p>
                  <p className="text-dark-50">{quote.desired_delivery_date}</p>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Shipping Address */}
        <Card className="p-4 bg-dark-700 border-dark-600">
          <h3 className="text-lg font-semibold text-dark-50 mb-4 flex items-center gap-2">
            <Truck className="w-5 h-5" />
            Shipping Address
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-dark-400 mt-0.5" />
              <div className="text-dark-50">
                <p>{quote.shipping_address_line1}</p>
                {quote.shipping_address_line2 && (
                  <p>{quote.shipping_address_line2}</p>
                )}
                <p>
                  {quote.shipping_city}, {quote.shipping_state} {quote.shipping_zip}
                </p>
                <p>{quote.shipping_country}</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Timestamps */}
        <Card className="p-4 bg-dark-700 border-dark-600">
          <h3 className="text-lg font-semibold text-dark-50 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Timeline
          </h3>
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-dark-400 mb-1">Created</p>
              <p className="text-dark-50">{formatDateShort(quote.created_at)}</p>
            </div>
            {quote.submitted_at && (
              <div>
                <p className="text-dark-400 mb-1">Submitted</p>
                <p className="text-dark-50">{formatDateShort(quote.submitted_at)}</p>
              </div>
            )}
            {quote.quoted_at && (
              <div>
                <p className="text-dark-400 mb-1">Quoted</p>
                <p className="text-dark-50">{formatDateShort(quote.quoted_at)}</p>
              </div>
            )}
            {quote.accepted_at && (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <div>
                  <p className="text-dark-400 mb-1">Accepted</p>
                  <p className="text-dark-50">{formatDateShort(quote.accepted_at)}</p>
                </div>
              </div>
            )}
            {quote.quote_valid_until && (
              <div>
                <p className="text-dark-400 mb-1">Valid Until</p>
                <p className="text-dark-50">{formatDateShort(quote.quote_valid_until)}</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Special Instructions */}
      {(quote.special_instructions || quote.rush_order || quote.requires_com) && (
        <Card className="p-4 bg-dark-700 border-dark-600">
          <h3 className="text-lg font-semibold text-dark-50 mb-4">Special Instructions</h3>
          <div className="space-y-2 text-sm">
            {quote.special_instructions && (
              <p className="text-dark-200">{quote.special_instructions}</p>
            )}
            <div className="flex flex-wrap gap-3 pt-2">
              {quote.rush_order && (
                <Badge variant="warning" className="inline-flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Rush Order
                </Badge>
              )}
              {quote.requires_com && (
                <Badge variant="info" className="inline-flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Requires COM
                </Badge>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Quote Items */}
      {quote.items && quote.items.length > 0 && (
        <Card className="p-4 bg-dark-700 border-dark-600">
          <h3 className="text-lg font-semibold text-dark-50 mb-4 flex items-center gap-2">
            <Package className="w-5 h-5" />
            Items ({quote.items.length})
          </h3>
          <div className="space-y-4">
            {quote.items.map((item) => (
              <div
                key={item.id}
                className="border border-dark-600 rounded-lg p-4 bg-dark-800"
              >
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div className="flex-1">
                    <h4 className="font-semibold text-dark-50 mb-1">
                      {item.product_name}
                    </h4>
                    <p className="text-sm text-dark-400 mb-2">
                      Model: {item.product_model_number}
                    </p>
                    <div className="flex flex-wrap gap-4 text-sm text-dark-300">
                      <span>Quantity: {item.quantity}</span>
                      <span>Unit Price: {formatCurrency(item.unit_price)}</span>
                      {item.customization_cost > 0 && (
                        <span>Customization: {formatCurrency(item.customization_cost)}</span>
                      )}
                    </div>
                    {item.item_notes && (
                      <div className="mt-2 pt-2 border-t border-dark-600">
                        <p className="text-sm text-dark-400">Notes:</p>
                        <p className="text-sm text-dark-200">{item.item_notes}</p>
                      </div>
                    )}
                    {item.custom_options && Object.keys(item.custom_options).length > 0 && (
                      <div className="mt-2 pt-2 border-t border-dark-600">
                        <p className="text-sm text-dark-400 mb-1">Custom Options:</p>
                        <div className="text-sm text-dark-200">
                          {JSON.stringify(item.custom_options, null, 2)}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-dark-50">
                      {formatCurrency(item.line_total)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Quote Totals */}
      <Card className="p-4 bg-dark-700 border-dark-600">
        <h3 className="text-lg font-semibold text-dark-50 mb-4 flex items-center gap-2">
          <DollarSign className="w-5 h-5" />
          Pricing Summary
        </h3>
        <div className="space-y-2">
          <div className="flex justify-between text-dark-200">
            <span>Subtotal:</span>
            <span>{formatCurrency(quote.subtotal)}</span>
          </div>
          {quote.tax_amount > 0 && (
            <div className="flex justify-between text-dark-200">
              <span>Tax:</span>
              <span>{formatCurrency(quote.tax_amount)}</span>
            </div>
          )}
          {quote.shipping_cost > 0 && (
            <div className="flex justify-between text-dark-200">
              <span>Shipping:</span>
              <span>{formatCurrency(quote.shipping_cost)}</span>
            </div>
          )}
          {quote.discount_amount > 0 && (
            <div className="flex justify-between text-dark-200">
              <span>Discount:</span>
              <span className="text-green-400">-{formatCurrency(quote.discount_amount)}</span>
            </div>
          )}
          <div className="flex justify-between text-lg font-bold text-dark-50 pt-2 border-t border-dark-600">
            <span>Total:</span>
            <span>{formatCurrency(quote.total_amount)}</span>
          </div>
          {quote.quoted_price && quote.quoted_price !== quote.total_amount && (
            <div className="flex justify-between text-primary-400 pt-2">
              <span>Quoted Price:</span>
              <span className="font-bold">{formatCurrency(quote.quoted_price)}</span>
            </div>
          )}
        </div>
      </Card>

      {/* Admin Notes */}
      {quote.quote_notes && (
        <Card className="p-4 bg-dark-700 border-dark-600">
          <h3 className="text-lg font-semibold text-dark-50 mb-4">Quote Notes</h3>
          <p className="text-dark-200">{quote.quote_notes}</p>
          {quote.quoted_lead_time && (
            <div className="mt-3 pt-3 border-t border-dark-600">
              <p className="text-sm text-dark-400 mb-1">Estimated Lead Time:</p>
              <p className="text-dark-50">{quote.quoted_lead_time}</p>
            </div>
          )}
        </Card>
      )}

      {/* Quote PDF Link */}
      {quote.quote_pdf_url && (
        <Card className="p-4 bg-dark-700 border-dark-600">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-dark-50 mb-1">Quote PDF</h3>
              <p className="text-sm text-dark-300">Download the official quote document</p>
            </div>
            <Button
              variant="primary"
              onClick={() => window.open(quote.quote_pdf_url, '_blank')}
            >
              Download PDF
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
};

export default QuoteDetailsView;

