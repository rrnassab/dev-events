import mongoose, { Document, Model, Schema, Types } from 'mongoose';
import { Event } from './event.model';

// Attributes required to create a Booking
export interface BookingAttrs {
  eventId: Types.ObjectId;
  email: string;
}

// Booking document as stored in MongoDB
export interface BookingDocument extends BookingAttrs, Document {
  createdAt: Date;
  updatedAt: Date;
}

export interface BookingModel extends Model<BookingDocument> {}

// Simple email validation regex for basic format checking
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const bookingSchema = new Schema<BookingDocument>(
  {
    eventId: {
      type: Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
      index: true, // index for faster lookups by event
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
  },
  {
    timestamps: true, // automatically manages createdAt and updatedAt
  }
);

// Additional index on eventId for query performance
bookingSchema.index({ eventId: 1 });

// Pre-save hook to validate email format and ensure referenced Event exists
bookingSchema.pre<BookingDocument>('save', async function (next) {
  // Validate email format
  if (!this.email || !emailRegex.test(this.email)) {
    return next(new Error('A valid email address is required.'));
  }

  // Ensure eventId is present
  if (!this.eventId) {
    return next(new Error('eventId is required.'));
  }

  try {
    // Verify that the referenced Event exists before allowing the booking
    const eventExists = await Event.exists({ _id: this.eventId });
    if (!eventExists) {
      return next(new Error('Referenced event does not exist.'));
    }

    return next();
  } catch (error) {
    return next(error as Error);
  }
});

// Reuse model in dev/hot-reload environments instead of recompiling
export const Booking: BookingModel =
  (mongoose.models.Booking as BookingModel | undefined) ||
  mongoose.model<BookingDocument, BookingModel>('Booking', bookingSchema);
