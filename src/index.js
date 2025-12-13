import mongoose from 'mongoose'
import express from 'express'
import {DB_NAME} from './constants.js'
import dotenv from 'dotenv'

dotenv.config()
const app = express()

;(async () => {
    try {
        await mongoose.connect(`${process.env.MONGO_URI}/${DB_NAME}`)
        app.on('error', (error) => {
            console.log("Unable to connect to db......\n",error)
            throw error
        })
        console.log("DB connected successfully :)")
        app.listen(process.env.PORT, () => {
            console.log(`Listening on port ${process.env.PORT}.....`)
        })
    } catch (error) {
        console.error("Error while connecting db !!!\n", error)
        throw error
    }
})()