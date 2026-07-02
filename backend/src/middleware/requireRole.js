// Revalida el rol en el backend en cada endpoint protegido.
// Nunca confiar en lo que el frontend oculte visualmente.
function requireRole(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.user || !rolesPermitidos.includes(req.user.rol)) {
      return res.status(403).json({ error: 'No tienes permisos para acceder a este recurso.' });
    }
    next();
  };
}

module.exports = requireRole;
