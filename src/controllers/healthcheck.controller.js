import {ApiResponse} from '../utils/api-response.js'
import  {asyncHandler} from '../utils/async-handler.js'

// const healthCheck =  async (req, res, next) => {
//     try {
//         const user = await getUserFromDB() // Simulate a database call to check if the server can connect to the database
//         res.status(200).json(
//             new ApiResponse(200, {message: 'server is healthy'})
//         )
//     } catch (error){
//         next(error)
//     }
// }

const healthCheck = asyncHandler(async (req, res, next) => { 
   
    res.status(200).json(
        new ApiResponse(200, {message: 'server is  healthy'})
    )
});

export { healthCheck }