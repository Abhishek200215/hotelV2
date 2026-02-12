import jwt from "jsonwebtoken";

export function signJwt(payload, secret, expiresIn="7d"){
  return jwt.sign(payload, secret, { expiresIn });
}

export function requireHotelAuth(){
  return (req,res,next)=>{
    const token=(req.headers.authorization||"").replace("Bearer ","");
    if(!token) return res.status(401).json({error:"Missing token"});
    try{
      const data=jwt.verify(token, process.env.JWT_SECRET);
      if(data.kind!=="HOTEL") return res.status(403).json({error:"Forbidden"});
      req.user=data;
      next();
    }catch{
      return res.status(401).json({error:"Invalid token"});
    }
  };
}

export function requireRole(role){
  return (req,res,next)=>{
    if(req.user.role===role || req.user.role==="ADMIN") return next();
    return res.status(403).json({error:"Forbidden"});
  };
}

export function requirePlatform(){
  return (req,res,next)=>{
    const token=(req.headers.authorization||"").replace("Bearer ","");
    if(!token) return res.status(401).json({error:"Missing token"});
    try{
      const data=jwt.verify(token, process.env.JWT_SECRET);
      if(data.kind!=="PLATFORM") return res.status(403).json({error:"Forbidden"});
      req.platform=data;
      next();
    }catch{
      return res.status(401).json({error:"Invalid token"});
    }
  };
}
