module.exports = {
  apps: [
    {
      name: 'dhrishtee-directory',
      script: 'npm',
      args: 'start',
      env: {
        PORT: 7020,
        VITE_BLOB_SERVICE_SAS_URL: 'https://drishteedocdirectory.blob.core.windows.net/?sv=2024-11-04&ss=bfqt&srt=sco&sp=rwdlacupiytfx&se=2028-07-15T19:46:09Z&st=2025-07-15T11:31:09Z&spr=https,http&sig=J5cileCJ58bFdl3snTvwLMh4qTv48naFLf3nCWYjSyU%3D',
        VITE_CONTAINER_NAME: 'container1',
        VITE_FILE_SERVICE_URL: 'https://drishteedocdirectory.blob.core.windows.net/',
        VITE_LOGIN_URL: 'https://testexpenses.drishtee.in/SGCM/employee/employeeLogin'
      }
    }
  ]
};