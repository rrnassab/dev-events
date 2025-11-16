import mongoose, { Document, Model, Schema } from 'mongoose';

// Attributes required to create an Event
export interface EventAttrs {
  title: string;
  slug?: string; // auto-generated from title
  description: string;
  overview: string;
  image: string;
  venue: string;
  location: string;
  date: string; // stored as normalized ISO date (YYYY-MM-DD)
  time: string; // stored as normalized 24h time (HH:MM)
  mode: string;
  audience: string;
  agenda: string[];
  organizer: string;
  tags: string[];
}

// Event document as stored in MongoDB
export interface EventDocument extends EventAttrs, Document {
  createdAt: Date;
  updatedAt: Date;
}

export interface EventModel extends Model<EventDocument> {}

// Basic slugify utility to generate URL-friendly slugs from titles
const slugify = (value: string): string => {
  return value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // replace non-alphanumeric with dashes
    .replace(/^-+|-+$/g, ''); // trim leading/trailing dashes
};

// Normalize time to 24h HH:MM format; returns null if invalid
const normalizeTime = (value: string): string | null => {
  const trimmed = value.trim().toLowerCase();

  // Match formats like "13:30", "1:30 pm", "1pm"
  const timeRegex = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i;
  const match = trimmed.match(timeRegex);

  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  const period = match[3];

  if (minutes < 0 || minutes > 59) return null;

  if (period) {
    // Convert 12-hour clock to 24-hour
    if (hours < 1 || hours > 12) return null;
    if (period === 'pm' && hours !== 12) {
      hours += 12;
    } else if (period === 'am' && hours === 12) {
      hours = 0;
    }
  } else if (hours < 0 || hours > 23) {
    return null;
  }

  const hh = hours.toString().padStart(2, '0');
  const mm = minutes.toString().padStart(2, '0');

  return `${hh}:${mm}`;
};

const eventSchema = new Schema<EventDocument>(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, index: true }, // unique index for SEO-friendly URLs
    description: { type: String, required: true, trim: true },
    overview: { type: String, required: true, trim: true },
    image: { type: String, required: true, trim: true },
    venue: { type: String, required: true, trim: true },
    location: { type: String, required: true, trim: true },
    date: { type: String, required: true },
    time: { type: String, required: true },
    mode: { type: String, required: true, trim: true },
    audience: { type: String, required: true, trim: true },
    agenda: {
      type: [String],
      required: true,
      validate: {
        validator: (value: string[]) => Array.isArray(value) && value.length > 0,
        message: 'Agenda must contain at least one item.',
      },
    },
    organizer: { type: String, required: true, trim: true },
    tags: {
      type: [String],
      required: true,
      validate: {
        validator: (value: string[]) => Array.isArray(value) && value.length > 0,
        message: 'Tags must contain at least one item.',
      },
    },
  },
  {
    timestamps: true, // automatically manages createdAt and updatedAt
  }
);

// Pre-save hook to validate required fields, normalize date/time, and generate slug
eventSchema.pre<EventDocument>('save', function (next) {
  // Validate required string fields are non-empty
  const requiredStringFields: (keyof EventAttrs)[] = [
    'title',
    'description',
    'overview',
    'image',
    'venue',
    'location',
    'date',
    'time',
    'mode',
    'audience',
    'organizer',
  ];

  for (const field of requiredStringFields) {
    const value = this[field];
    if (typeof value !== 'string' || value.trim().length === 0) {
      return next(new Error(`Field "${String(field)}" is required and cannot be empty.`));
    }
  }

  // Validate agenda and tags arrays are non-empty
  if (!Array.isArray(this.agenda) || this.agenda.length === 0) {
    return next(new Error('Agenda must contain at least one item.'));
  }

  if (!Array.isArray(this.tags) || this.tags.length === 0) {
    return next(new Error('Tags must contain at least one item.'));
  }

  // Generate slug from title when creating or when title changes
  if (this.isNew || this.isModified('title')) {
    this.slug = slugify(this.title);
  }

  // Normalize date to ISO format (YYYY-MM-DD)
  if (this.isNew || this.isModified('date')) {
    const parsedDate = new Date(this.date);
    if (Number.isNaN(parsedDate.getTime())) {
      return next(new Error('Invalid date format. Expected a valid date string.'));
    }
    this.date = parsedDate.toISOString().split('T')[0];
  }

  // Normalize time to 24h HH:MM
  if (this.isNew || this.isModified('time')) {
    const normalizedTime = normalizeTime(this.time);
    if (!normalizedTime) {
      return next(new Error('Invalid time format. Expected a valid time (e.g., "13:30" or "1:30 pm").'));
    }
    this.time = normalizedTime;
  }

  next();
});

// Reuse model in dev/hot-reload environments instead of recompiling
export const Event: EventModel =
  (mongoose.models.Event as EventModel | undefined) ||
  mongoose.model<EventDocument, EventModel>('Event', eventSchema);
