import { BadRequestException } from '@nestjs/common';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';

export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

const fileFilter: MulterOptions['fileFilter'] = (_request, file, callback) => {
  if (
    !file.originalname ||
    file.originalname.includes('\0') ||
    !/^[\w.+-]+\/[\w.+-]+$/.test(file.mimetype)
  ) {
    callback(new BadRequestException('Invalid upload metadata'), false);
    return;
  }
  callback(null, true);
};

export const singleFileUploadOptions: MulterOptions = {
  limits: {
    fileSize: MAX_UPLOAD_BYTES,
    files: 1,
    fields: 100,
    parts: 101,
  },
  fileFilter,
};

export const videoEditUploadOptions: MulterOptions = {
  limits: {
    fileSize: MAX_UPLOAD_BYTES,
    files: 3,
    fields: 100,
    parts: 103,
  },
  fileFilter,
};
