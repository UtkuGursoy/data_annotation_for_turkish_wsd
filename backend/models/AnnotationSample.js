const mongoose = require('mongoose');

const annotationSampleSchema = new mongoose.Schema({
  sample_id: { type: String, required: true, unique: true },
  homonym: { type: String, required: true },
  judged_meaning: { type: String, required: true },
  precontext: { type: String, default: "" },
  sentence: { type: String, required: true },
  ending: { type: String, default: "" },
  example_sentence: { type: String, default: "" },
  
  // Fields to store annotation results
  choices: { type: [Number], default: [] },
  average: { type: Number, default: null },
  stdev: { type: Number, default: null },
  nonsensical: { type: [Boolean], default: [] }
});

module.exports = mongoose.model('AnnotationSample', annotationSampleSchema);