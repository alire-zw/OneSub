const validateMobile = (mobile) => {
  if (typeof mobile !== 'string') return false;
  const mobileRegex = /^09\d{9}$/;
  return mobileRegex.test(mobile.trim());
};

const validateOTP = (otp) => {
  if (typeof otp !== 'string') return false;
  const otpRegex = /^\d{5}$/;
  return otpRegex.test(otp.trim());
};

const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  return input.trim().replace(/[<>]/g, '');
};

const validateSendOTP = (req, res, next) => {
  const { mobile } = req.body;

  if (!mobile) {
    return res.status(400).json({
      status: 0,
      message: 'Mobile number is required'
    });
  }

  const sanitizedMobile = sanitizeInput(mobile);
  
  if (!validateMobile(sanitizedMobile)) {
    return res.status(400).json({
      status: 0,
      message: 'Invalid mobile number format. Use 09xxxxxxxxx'
    });
  }

  req.body.mobile = sanitizedMobile;
  next();
};

const validateVerifyOTP = (req, res, next) => {
  const { mobile, otp } = req.body;

  if (!mobile || !otp) {
    return res.status(400).json({
      status: 0,
      message: 'Mobile number and OTP are required'
    });
  }

  const sanitizedMobile = sanitizeInput(mobile);
  const sanitizedOTP = sanitizeInput(otp);

  if (!validateMobile(sanitizedMobile)) {
    return res.status(400).json({
      status: 0,
      message: 'Invalid mobile number format'
    });
  }

  if (!validateOTP(sanitizedOTP)) {
    return res.status(400).json({
      status: 0,
      message: 'Invalid OTP format. OTP must be 5 digits'
    });
  }

  req.body.mobile = sanitizedMobile;
  req.body.otp = sanitizedOTP;
  next();
};

module.exports = {
  validateMobile,
  validateOTP,
  sanitizeInput,
  validateSendOTP,
  validateVerifyOTP
};

