import mongoose, {Schema} from 'mongoose'

const subscriptionSchema = new Schema({
    channel: {
        type: mongoose.Types.ObjectId,
        ref: "User"
    },
    subscriber: {
        type: mongoose.Types.ObjectId,
        ref: "User"
    }
},{ timestamps: true })

export const Subscription = mongoose.model("Subscription", subscriptionSchema)