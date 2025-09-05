export default defineEventHandler(async (event) => {
  try {
    // Clear the authentication cookie
    deleteCookie(event, 'auth-token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/'
    })
    
    return {
      success: true,
      message: 'Logged out successfully'
    }
    
  } catch (error: any) {
    console.error('Logout error:', error)
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Logout failed'
    })
  }
})