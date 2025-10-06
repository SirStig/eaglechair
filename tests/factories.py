"""
Test Factories

Factory Boy factories for creating test data
"""

import factory
from factory.alchemy import SQLAlchemyModelFactory
from faker import Faker

from backend.models.company import Company, AdminUser, CompanyStatus, AdminRole
from backend.models.chair import Chair, Category, Finish, Upholstery
from backend.models.quote import Quote, QuoteItem, Cart, CartItem, QuoteStatus
from backend.models.content import FAQ, FAQCategory, TeamMember, CompanyInfo, ContactLocation, Catalog, Installation
from backend.core.security import hash_password

fake = Faker()


class CompanyFactory(SQLAlchemyModelFactory):
    """Factory for creating Company instances."""
    
    class Meta:
        model = Company
        sqlalchemy_session_persistence = "commit"
    
    company_name = factory.LazyFunction(lambda: fake.company())
    contact_name = factory.LazyFunction(lambda: fake.name())
    contact_email = factory.LazyFunction(lambda: fake.email())
    contact_phone = factory.LazyFunction(lambda: fake.phone_number())
    address_line1 = factory.LazyFunction(lambda: fake.street_address())
    address_line2 = factory.LazyFunction(lambda: fake.secondary_address())
    city = factory.LazyFunction(lambda: fake.city())
    state = factory.LazyFunction(lambda: fake.state_abbr())
    zip_code = factory.LazyFunction(lambda: fake.zipcode())
    country = "USA"
    website = factory.LazyFunction(lambda: fake.url())
    industry = factory.LazyFunction(lambda: fake.job())
    company_size = factory.LazyFunction(lambda: fake.random_element(["1-10", "11-50", "51-100", "100+"]))
    tax_id = factory.LazyFunction(lambda: fake.bothify(text="##-#######"))
    password_hash = factory.LazyFunction(lambda: hash_password("TestPassword123!"))
    status = factory.LazyFunction(lambda: fake.random_element([CompanyStatus.ACTIVE, CompanyStatus.PENDING]))


class AdminUserFactory(SQLAlchemyModelFactory):
    """Factory for creating AdminUser instances."""
    
    class Meta:
        model = AdminUser
        sqlalchemy_session_persistence = "commit"
    
    username = factory.LazyFunction(lambda: fake.user_name())
    email = factory.LazyFunction(lambda: fake.email())
    password_hash = factory.LazyFunction(lambda: hash_password("TestPassword123!"))
    first_name = factory.LazyFunction(lambda: fake.first_name())
    last_name = factory.LazyFunction(lambda: fake.last_name())
    role = factory.LazyFunction(lambda: fake.random_element([AdminRole.ADMIN, AdminRole.MANAGER, AdminRole.VIEWER]))
    is_active = True
    last_login_ip = factory.LazyFunction(lambda: fake.ipv4())


class CategoryFactory(SQLAlchemyModelFactory):
    """Factory for creating Category instances."""
    
    class Meta:
        model = Category
        sqlalchemy_session_persistence = "commit"
    
    name = factory.LazyFunction(lambda: fake.random_element([
        "Executive Chairs", "Office Chairs", "Conference Chairs", 
        "Reception Chairs", "Dining Chairs", "Bar Stools"
    ]))
    description = factory.LazyFunction(lambda: fake.text(max_nb_chars=200))
    slug = factory.LazyAttribute(lambda obj: obj.name.lower().replace(" ", "-"))
    is_active = True
    sort_order = factory.LazyFunction(lambda: fake.random_int(min=1, max=100))


class FinishFactory(SQLAlchemyModelFactory):
    """Factory for creating Finish instances."""
    
    class Meta:
        model = Finish
        sqlalchemy_session_persistence = "commit"
    
    name = factory.LazyFunction(lambda: fake.random_element([
        "Oak", "Walnut", "Cherry", "Maple", "Mahogany", "Pine"
    ]))
    description = factory.LazyFunction(lambda: fake.text(max_nb_chars=100))
    color_code = factory.LazyFunction(lambda: fake.hex_color())
    is_active = True
    sort_order = factory.LazyFunction(lambda: fake.random_int(min=1, max=100))


class UpholsteryFactory(SQLAlchemyModelFactory):
    """Factory for creating Upholstery instances."""
    
    class Meta:
        model = Upholstery
        sqlalchemy_session_persistence = "commit"
    
    name = factory.LazyFunction(lambda: fake.random_element([
        "Leather", "Fabric", "Vinyl", "Mesh", "Suede"
    ]))
    description = factory.LazyFunction(lambda: fake.text(max_nb_chars=100))
    color_code = factory.LazyFunction(lambda: fake.hex_color())
    is_active = True
    sort_order = factory.LazyFunction(lambda: fake.random_int(min=1, max=100))


class ChairFactory(SQLAlchemyModelFactory):
    """Factory for creating Chair instances."""
    
    class Meta:
        model = Chair
        sqlalchemy_session_persistence = "commit"
    
    name = factory.LazyFunction(lambda: fake.random_element([
        "Executive Chair", "Office Chair", "Conference Chair", 
        "Reception Chair", "Dining Chair", "Bar Stool"
    ]))
    description = factory.LazyFunction(lambda: fake.text(max_nb_chars=500))
    model_number = factory.LazyFunction(lambda: fake.bothify(text="CHR-####"))
    base_price = factory.LazyFunction(lambda: fake.random_int(min=10000, max=100000))  # $100-$1000 in cents
    minimum_order_quantity = factory.LazyFunction(lambda: fake.random_int(min=1, max=10))
    is_active = True
    specifications = factory.LazyFunction(lambda: {
        "seat_height": f"{fake.random_int(min=16, max=24)} inches",
        "weight_capacity": f"{fake.random_int(min=200, max=400)} lbs"
    })
    features = factory.LazyFunction(lambda: fake.random_elements(
        ["Lumbar support", "Adjustable height", "Swivel base", "Armrests", "Headrest"], 
        length=fake.random_int(min=1, max=3)
    ))
    dimensions = factory.LazyFunction(lambda: {
        "width": fake.random_int(min=20, max=30),
        "depth": fake.random_int(min=20, max=30),
        "height": fake.random_int(min=35, max=50)
    })
    weight = factory.LazyFunction(lambda: fake.random_int(min=20, max=80))
    materials = factory.LazyFunction(lambda: fake.random_elements(
        ["Leather", "Steel", "Wood", "Fabric", "Plastic"], 
        length=fake.random_int(min=2, max=4)
    ))
    colors = factory.LazyFunction(lambda: fake.random_elements(
        ["Black", "Brown", "Gray", "White", "Blue"], 
        length=fake.random_int(min=1, max=3)
    ))


class CartFactory(SQLAlchemyModelFactory):
    """Factory for creating Cart instances."""
    
    class Meta:
        model = Cart
        sqlalchemy_session_persistence = "commit"
    
    is_active = True


class CartItemFactory(SQLAlchemyModelFactory):
    """Factory for creating CartItem instances."""
    
    class Meta:
        model = CartItem
        sqlalchemy_session_persistence = "commit"
    
    quantity = factory.LazyFunction(lambda: fake.random_int(min=1, max=10))
    unit_price = factory.LazyFunction(lambda: fake.random_int(min=10000, max=100000))
    custom_notes = factory.LazyFunction(lambda: fake.text(max_nb_chars=200))


class QuoteFactory(SQLAlchemyModelFactory):
    """Factory for creating Quote instances."""
    
    class Meta:
        model = Quote
        sqlalchemy_session_persistence = "commit"
    
    quote_number = factory.LazyFunction(lambda: fake.bothify(text="Q-########"))
    contact_name = factory.LazyFunction(lambda: fake.name())
    contact_email = factory.LazyFunction(lambda: fake.email())
    contact_phone = factory.LazyFunction(lambda: fake.phone_number())
    project_name = factory.LazyFunction(lambda: fake.catch_phrase())
    project_description = factory.LazyFunction(lambda: fake.text(max_nb_chars=500))
    project_type = factory.LazyFunction(lambda: fake.random_element([
        "Restaurant", "Hotel", "Office", "Retail", "Healthcare"
    ]))
    estimated_quantity = factory.LazyFunction(lambda: fake.random_int(min=10, max=1000))
    target_budget = factory.LazyFunction(lambda: fake.random_int(min=100000, max=1000000))
    desired_delivery_date = factory.LazyFunction(lambda: fake.date_between(start_date="+1m", end_date="+6m").isoformat())
    shipping_address_line1 = factory.LazyFunction(lambda: fake.street_address())
    shipping_address_line2 = factory.LazyFunction(lambda: fake.secondary_address())
    shipping_city = factory.LazyFunction(lambda: fake.city())
    shipping_state = factory.LazyFunction(lambda: fake.state_abbr())
    shipping_zip = factory.LazyFunction(lambda: fake.zipcode())
    shipping_country = "USA"
    status = factory.LazyFunction(lambda: fake.random_element([
        QuoteStatus.DRAFT, QuoteStatus.PENDING, QuoteStatus.QUOTED, 
        QuoteStatus.ACCEPTED, QuoteStatus.REJECTED
    ]))
    subtotal = factory.LazyFunction(lambda: fake.random_int(min=100000, max=1000000))
    tax_amount = factory.LazyFunction(lambda: fake.random_int(min=10000, max=100000))
    shipping_cost = factory.LazyFunction(lambda: fake.random_int(min=5000, max=50000))
    total_amount = factory.LazyFunction(lambda: fake.random_int(min=150000, max=1200000))
    special_instructions = factory.LazyFunction(lambda: fake.text(max_nb_chars=300))
    requires_com = factory.LazyFunction(lambda: fake.boolean())
    rush_order = factory.LazyFunction(lambda: fake.boolean())


class QuoteItemFactory(SQLAlchemyModelFactory):
    """Factory for creating QuoteItem instances."""
    
    class Meta:
        model = QuoteItem
        sqlalchemy_session_persistence = "commit"
    
    quantity = factory.LazyFunction(lambda: fake.random_int(min=1, max=50))
    unit_price = factory.LazyFunction(lambda: fake.random_int(min=10000, max=100000))
    custom_notes = factory.LazyFunction(lambda: fake.text(max_nb_chars=200))


class FAQCategoryFactory(SQLAlchemyModelFactory):
    """Factory for creating FAQCategory instances."""
    
    class Meta:
        model = FAQCategory
        sqlalchemy_session_persistence = "commit"
    
    name = factory.LazyFunction(lambda: fake.random_element([
        "General", "Products", "Shipping", "Warranty", "Returns"
    ]))
    description = factory.LazyFunction(lambda: fake.text(max_nb_chars=200))
    is_active = True
    sort_order = factory.LazyFunction(lambda: fake.random_int(min=1, max=100))


class FAQFactory(SQLAlchemyModelFactory):
    """Factory for creating FAQ instances."""
    
    class Meta:
        model = FAQ
        sqlalchemy_session_persistence = "commit"
    
    question = factory.LazyFunction(lambda: fake.sentence(nb_words=8))
    answer = factory.LazyFunction(lambda: fake.text(max_nb_chars=500))
    is_active = True
    sort_order = factory.LazyFunction(lambda: fake.random_int(min=1, max=100))


class TeamMemberFactory(SQLAlchemyModelFactory):
    """Factory for creating TeamMember instances."""
    
    class Meta:
        model = TeamMember
        sqlalchemy_session_persistence = "commit"
    
    name = factory.LazyFunction(lambda: fake.name())
    position = factory.LazyFunction(lambda: fake.job())
    bio = factory.LazyFunction(lambda: fake.text(max_nb_chars=300))
    email = factory.LazyFunction(lambda: fake.email())
    phone = factory.LazyFunction(lambda: fake.phone_number())
    image_url = factory.LazyFunction(lambda: fake.image_url())
    is_active = True
    sort_order = factory.LazyFunction(lambda: fake.random_int(min=1, max=100))


class ContactLocationFactory(SQLAlchemyModelFactory):
    """Factory for creating ContactLocation instances."""
    
    class Meta:
        model = ContactLocation
        sqlalchemy_session_persistence = "commit"
    
    name = factory.LazyFunction(lambda: fake.random_element([
        "Headquarters", "Showroom", "Warehouse", "Sales Office"
    ]))
    address_line1 = factory.LazyFunction(lambda: fake.street_address())
    address_line2 = factory.LazyFunction(lambda: fake.secondary_address())
    city = factory.LazyFunction(lambda: fake.city())
    state = factory.LazyFunction(lambda: fake.state_abbr())
    zip_code = factory.LazyFunction(lambda: fake.zipcode())
    country = "USA"
    phone = factory.LazyFunction(lambda: fake.phone_number())
    email = factory.LazyFunction(lambda: fake.email())
    hours = factory.LazyFunction(lambda: "Monday-Friday: 9AM-5PM")
    is_active = True
    sort_order = factory.LazyFunction(lambda: fake.random_int(min=1, max=100))
