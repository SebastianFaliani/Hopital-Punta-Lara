import { Request, Response } from 'express';
import { registerUser } from './auth.service';
import { loginUser } from './auth.service';
import { AuthRequest } from './auth.middleware';


export async function register(
    req: Request,
    res: Response
) {

    try {

        const result = await registerUser(req.body);

        return res.status(201).json({
            success: true,
            data: result
        });

    } catch (error: any) {

        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
}

export async function login(
    req: Request,
    res: Response
) {

    try {

        const result = await loginUser(req.body);

        return res.status(200).json({
            success: true,
            data: result
        });

    } catch (error: any) {

        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
}

export async function me(
    req: AuthRequest,
    res: Response
) {

    return res.status(200).json({
        success: true,
        user: req.user
    });
}