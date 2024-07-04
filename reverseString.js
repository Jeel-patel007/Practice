let string = "good morning";
let reverse = ""
for (let i = string.length - 1; i >= 0; i--) {
  reverse += string[i]
}
console.log(reverse);


let reversedString = string.split('').reverse().join('');
console.log(reversedString);

let reverseString2 = [...string].reverse().join('');
console.log(reverseString2);

const { generalResponse } = require('../helpers/generalResponce');
const db = require('../models');

const { property, user_has_property, job, property_has_job } = db;

const addProperty = async (req, res) => {
  const t = await db.sequelize.transaction();
  try {
    const { userId, propertyName, propertyLocation, propertyDescription, jobName, jobDescription } = req.body;
    const propertyFiles = req.files;

    // Create property
    const newProperty = await property.create({
      name: propertyName,
      address: propertyLocation,
      image: propertyFiles[0].path,
      description: propertyDescription,
    }, { transaction: t });

    const propertyId = newProperty.id;

    // Associate property with user
    await user_has_property.create({
      user_id: userId,
      property_id: propertyId,
    }, { transaction: t });

    // Create jobs and associate them with the property
    const jobPromises = Array.isArray(jobName) ? jobName.map((name, index) => {
      return createJobAndAssociate(name, jobDescription[index], propertyFiles[index + 1].path, propertyId, t);
    }) : [createJobAndAssociate(jobName, jobDescription, propertyFiles[1].path, propertyId, t)];

    await Promise.all(jobPromises);

    await t.commit();
    return generalResponse(res, { data: newProperty }, "Property added successfully.", true);
  } catch (error) {
    await t.rollback();
    console.error("Error while adding property:", error);
    return generalResponse(res, { success: false }, "Something went wrong!", "error", true);
  }
};

const createJobAndAssociate = async (title, description, imagePath, propertyId, transaction) => {
  const jobData = await job.create({
    title,
    description,
    image: imagePath,
  }, { transaction });

  await property_has_job.create({
    property_id: propertyId,
    job_id: jobData.id,
  }, { transaction });
};

module.exports = { addProperty };


const rules = {
  propertyName: { required },
  propertyLocation: { required },
  propertyImage: { required },
  jobs: {
    $each: helpers.forEach({
      name: {
        required,
      },
      image: {
        required,
      }
    }),
  },
};


<v-file-input
  v-model="job.image"
  accept="image/*"
  label="Job Image"
  prepend-icon="mdi-camera"
  width="300"
  :error-messages="v$.jobs.$errors.map((e) => e.$message[index].image)"
></v-file-input>

