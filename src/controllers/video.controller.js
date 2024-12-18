import mongoose, {isValidObjectId} from "mongoose"
import {Video} from "../models/video.model.js"
import {User} from "../models/user.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"


const getAllVideos = asyncHandler(async (req, res) => {
    // const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query
    //TODO: get all videos based on query, sort, pagination

    const { page = 1, limit = 10, query = '', sortBy = '_id', sortType = 'asc', userId } = req.query;


    const matchStage = {};
    if (query) {
        matchStage.title = {
            $regex: query,
            $options: "i" 
        };
    }

    if (userId && isValidObjectId(userId)) {
        matchStage.userId = mongoose.Types.ObjectId(userId);
    }


    const sortOptions = {
        [sortBy]: sortType === "asc" ? 1 : -1
    };


    const pipeline = [
        { $match: matchStage },
        { $sort: sortOptions },
        { $skip: (page - 1) * parseInt(limit) },
        { $limit: parseInt(limit) },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner"
            }
        },
        { $unwind: "$owner" },
        {
            $project: {
                title: 1,
                description: 1,
                videofile: 1,
                thumbnail: 1,
                duration: 1,
                views: 1,
                isPublished: 1,
                createdAt: 1,
                "owner.username": 1
            }
        }
    ];


    const videos = await Video.aggregate(pipeline);


    const totalVideos = await Video.countDocuments(matchStage);


    return res.status(200).json(new ApiResponse(200, { videos, totalVideos, page, limit }, "Get All videos Successfully"));
});

const publishAVideo = asyncHandler(async (req, res) => {
    const { title, description} = req.body
    // TODO: get video, upload to cloudinary, create video
    // const { videoFile, thumbnail } = req.files;

    const videoFile  = req.files?.avatar[0]?.path;
    const thumbnail  = req.files?.avatar[0]?.path;

    if (!videoFile || !thumbnail) {
        throw new ApiError(400, 'Video file and thumbnail are required.');
    }


    const videoUploadResult = await uploadOnCloudinary(videoFile);
    const thumbnailUploadResult = await uploadOnCloudinary(thumbnail);


    const newVideo = new Video({
        title,
        description,
        videofile: videoUploadResult.secure_url,
        thumbnail: thumbnailUploadResult.secure_url,
        duration: videoUploadResult.duration || 0, 
        views: 0,
        isPublished: true,
        createdAt: new Date(),
        owner: req.user._id 
    });

    await newVideo.save();

    return res.status(201).json(new ApiResponse(201, newVideo, 'Video published successfully'));
})

const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: get video by id
    try {
        const video = await Video.findById(videoId)
        if (!video) {
            throw new ApiError(400, "Video not found")
        }
        res.status(200).json(new ApiResponse(200, video, "Video found Successfully"))
    } catch (error) {
        throw new ApiError(500, "Server error")
    }
})

const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: update video details like title, description, thumbnail
    const { title, description, thumbnail: newthumbnail } = req.body;

    if (!title && !description && !newthumbnail) {
        throw new ApiError(400, "Any of one filed are required")
    }

    const video = await Video.findById(videoId)
    if (!video) {
        throw new ApiError(404, "Video not found")
    }

    if (newthumbnail && video?.thumbnail) {
        await deleteFromCloudinary(video?.thumbnail)
    }

    let thumbnailUrl = video.thumbnail;
    if (newthumbnail) {
        thumbnailUrl = await uploadOnCloudinary(newthumbnail)
    }

    const updatedVideo = await Video.findByIdAndUpdate(
        videoId,
        {
            $set: {
                title: title || video.title,
                description: description || video.description,
                thumbnail: thumbnailUrl.url
            }
        },
        {
            new: true
        }
    );

    return res
        .status(200)
        .json(new ApiResponse(200, updatedVideo, "Video details updated successfully"))
})


const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params

    if(!videoId){
        throw new ApiError(401, "Video not found")
    }
    //TODO: delete video
    await Video.findByIdAndDelete(videoId)

    return res
    .status(200)
    .json(new ApiResponse(200, {}, "Video Deleted Successfully"))
})

const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    const video = await Video.findById(videoId)
    if (!video) {
        throw new ApiError(404, "Video not found")
    }

    video.isPublished = !video.isPublished
    await video.save()

    return res
        .status(200)
        .json(new ApiResponse(200, video, "Video status updated successfully"))
})

export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus
}