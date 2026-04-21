/**
 * Vérifie que l'utilisateur a l'un des rôles autorisés
 * Usage: requireRole('admin_app', 'admin_service')
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.profile) {
      return res.status(401).json({ error: 'Non authentifié' });
    }
    if (!roles.includes(req.profile.role)) {
      return res.status(403).json({
        error: `Accès refusé. Rôle requis: ${roles.join(', ')}. Votre rôle: ${req.profile.role}`
      });
    }
    next();
  };
}

/**
 * Vérifie que l'utilisateur a accès au service demandé
 * admin_app a accès à tous les services
 * Les autres rôles sont limités à leur service
 */
export function requireServiceScope(req, res, next) {
  const { profile } = req;
  if (!profile) return res.status(401).json({ error: 'Non authentifié' });

  // admin_app : accès total
  if (profile.role === 'admin_app') return next();

  const serviceId = req.params.serviceId || req.query.service_id || req.body.service_id;

  if (serviceId && profile.service_id && serviceId !== profile.service_id) {
    return res.status(403).json({ error: 'Accès refusé à ce service' });
  }

  // Injecte le service_id dans la requête pour les controllers
  if (!serviceId && profile.service_id) {
    req.scopedServiceId = profile.service_id;
  } else {
    req.scopedServiceId = serviceId || profile.service_id;
  }

  next();
}

/**
 * Vérifie l'accès à une cellule spécifique
 * Pointeurs peuvent être multi-cellules → on vérifie via agent_assignments
 */
export function requireCelluleScope(allowedCellules) {
  return (req, res, next) => {
    const { profile } = req;
    if (!profile) return res.status(401).json({ error: 'Non authentifié' });
    if (profile.role === 'admin_app') return next();

    const celluleId = req.params.celluleId || req.query.cellule_id || req.body.cellule_id;
    if (!celluleId) return next();

    if (allowedCellules && !allowedCellules.includes(celluleId)) {
      return res.status(403).json({ error: 'Accès refusé à cette cellule' });
    }
    next();
  };
}
