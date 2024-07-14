const Campground = require('../models/campground');
const mbxGeocoding = require("@mapbox/mapbox-sdk/services/geocoding");
const mapBoxToken = process.env.MAPBOX_TOKEN;
const geocoder = mbxGeocoding({ accessToken: mapBoxToken });
const { cloudinary } = require("../cloudinary");

//og code before adding pagination
// module.exports.index = async (req, res) => {
//     const campgrounds = await Campground.find({}).populate('popupText');
//     res.render('campgrounds/index', { campgrounds })
// }
// module.exports.index = async (req, res) => {
//     const { page = 1, limit = 15, price, rating } = req.query;

//     // Create a filter object based on query parameters
//     let filter = {};
//     if (price) {
//         filter.price = { $lte: price };
//     }
//     if (rating) {
//         filter['reviews.rating'] = { $gte: rating };
//     }

//     // Find campgrounds with pagination and filtering
//     const campgrounds = await Campground.find(filter)
//         .populate('popupText')
//         .limit(limit * 1)
//         .skip((page - 1) * limit);

//     // Get total number of campgrounds for pagination
//     const count = await Campground.countDocuments(filter);

//     res.render('campgrounds/index1', {
//         campgrounds,
//         totalPages: Math.ceil(count / limit),
//         currentPage: parseInt(page),
//         price,
//         rating
//     });
// };
// module.exports.index = async (req, res) => {
//     const { page = 1, limit = 15, price, rating } = req.query;

//     // Create a filter object based on query parameters
//     let filter = {};
//     if (price) {
//         filter.price = { $lte: price };
//     }

//     let matchStage = { $match: filter };
//     let lookupStage = {
//         $lookup: {
//             from: 'reviews',
//             localField: 'reviews',
//             foreignField: '_id',
//             as: 'reviews'
//         }
//     };

//     let addFieldsStage = {
//         $addFields: {
//             averageRating: { $avg: '$reviews.rating' }
//         }
//     };

//     let matchRatingStage = {};
//     if (rating) {
//         matchRatingStage = {
//             $match: {
//                 averageRating: { $gte: parseFloat(rating) }
//             }
//         };
//     }

//     let paginationStage = [
//         { $skip: (page - 1) * limit },
//         { $limit: parseInt(limit) }
//     ];

//     // Aggregation pipeline
//     let pipeline = [matchStage, lookupStage, addFieldsStage, matchRatingStage, ...paginationStage];

//     // Execute the pipeline
//     const campgrounds = await Campground.aggregate(pipeline);

//     // Count total campgrounds
//     const countPipeline = [matchStage, lookupStage, addFieldsStage, matchRatingStage];
//     const countResult = await Campground.aggregate(countPipeline);
//     const count = countResult.length;

//     res.render('campgrounds/index1', {
//         campgrounds,
//         totalPages: Math.ceil(count / limit),
//         currentPage: parseInt(page),
//         price,
//         rating
//     });
// };

module.exports.index = async (req, res) => {
    const { page = 1, limit = 15, price, rating } = req.query;

    // Create a filter object based on query parameters
    let filter = {};
    if (price) {
        filter.price = { $lte: parseInt(price) };
    }

    let matchStage = { $match: filter };
    let lookupStage = {
        $lookup: {
            from: 'reviews',
            localField: 'reviews',
            foreignField: '_id',
            as: 'reviews'
        }
    };

    let addFieldsStage = {
        $addFields: {
            averageRating: { $avg: '$reviews.rating' }
        }
    };

    // Only add matchRatingStage if rating is provided
    let pipeline = [matchStage, lookupStage, addFieldsStage];

    if (rating) {
        let matchRatingStage = {
            $match: {
                averageRating: { $gte: parseFloat(rating) }
            }
        };
        pipeline.push(matchRatingStage);
    }

    // Add pagination stages
    pipeline = pipeline.concat([
        { $skip: (page - 1) * limit },
        { $limit: parseInt(limit) }
    ]);

    // Execute the pipeline
    const campgrounds = await Campground.aggregate(pipeline);

    // Count total campgrounds
    const countPipeline = [matchStage, lookupStage, addFieldsStage];
    if (rating) {
        countPipeline.push({
            $match: {
                averageRating: { $gte: parseFloat(rating) }
            }
        });
    }
    const countResult = await Campground.aggregate(countPipeline);
    const count = countResult.length;

    res.render('campgrounds/index1', {
        campgrounds,
        totalPages: Math.ceil(count / limit),
        currentPage: parseInt(page),
        price,
        rating
    });
};


module.exports.renderNewForm = (req, res) => {
    res.render('campgrounds/new');
}

module.exports.createCampground = async (req, res, next) => {
    const geoData = await geocoder.forwardGeocode({
        query: req.body.campground.location,
        limit: 1
    }).send()
    const campground = new Campground(req.body.campground);
    campground.geometry = geoData.body.features[0].geometry;
    campground.images = req.files.map(f => ({ url: f.path, filename: f.filename }));
    campground.author = req.user._id;
    await campground.save();
    console.log(campground, campground.images);
    req.flash('success', 'Successfully made a new campground!');
    res.redirect(`/campgrounds/${campground._id}`)
}

module.exports.showCampground = async (req, res,) => {
    const campground = await Campground.findById(req.params.id).populate({
        path: 'reviews',
        populate: {
            path: 'author'
        }
    }).populate('author');
    if (!campground) {
        req.flash('error', 'Cannot find that campground!');
        return res.redirect('/campgrounds');
    }
    console.log(campground);
    res.render('campgrounds/show', { campground });
}

module.exports.renderEditForm = async (req, res) => {
    const { id } = req.params;
    const campground = await Campground.findById(id)
    if (!campground) {
        req.flash('error', 'Cannot find that campground!');
        return res.redirect('/campgrounds');
    }
    res.render('campgrounds/edit', { campground });
}

module.exports.updateCampground = async (req, res) => {
    const { id } = req.params;
    console.log(req.body);
    const campground = await Campground.findByIdAndUpdate(id, { ...req.body.campground });
    const imgs = req.files.map(f => ({ url: f.path, filename: f.filename }));
    campground.images.push(...imgs);
    await campground.save();
    if (req.body.deleteImages) {
        for (let filename of req.body.deleteImages) {
            await cloudinary.uploader.destroy(filename);
        }
        await campground.updateOne({ $pull: { images: { filename: { $in: req.body.deleteImages } } } })
    }
    req.flash('success', 'Successfully updated campground!');
    res.redirect(`/campgrounds/${campground._id}`)
}

module.exports.deleteCampground = async (req, res) => {
    const { id } = req.params;
    await Campground.findByIdAndDelete(id);
    req.flash('success', 'Successfully deleted campground')
    res.redirect('/campgrounds');
}