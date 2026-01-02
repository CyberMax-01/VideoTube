import mongoose, {Schema} from 'mongoose'
import { User } from './user.model'

const subscriptionSchema = new Schema({
    channel: {
        type: mongoose.Types.ObjectId,
        ref: User
    },
    subscriber: {
        type: mongoose.Types.ObjectId,
        ref: User
    }
},{ timestamps: true })

export const Subscription = mongoose.model("Subscription", subscriptionSchema)